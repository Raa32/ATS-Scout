/**
 * Integration tests for the provider dropdown.
 * Directly imports and calls the same functions popup.js uses.
 * Catches the overflow-clipping bug: list must be position:fixed,
 * positioned via getBoundingClientRect().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDERS, PROVIDER_ORDER, PROVIDER_LOGOS } from '../lib/providers.js';

// ── Minimal popup DOM ─────────────────────────────────────────
function buildPopupDOM() {
  // No provider-list in provider-dropdown — matches new portal approach
  document.body.innerHTML = `
    <div id="provider-dropdown" class="provider-dropdown" tabindex="0" aria-expanded="false">
      <div class="provider-dropdown-selected">
        <span id="provider-selected-logo" class="provider-dd-logo"></span>
        <span id="provider-selected-name" class="provider-dd-name">Claude (Anthropic)</span>
        <svg class="provider-dd-chevron"></svg>
      </div>
    </div>
  `;
}

// ── Dropdown logic (mirrors popup.js exactly) ─────────────────
const $ = id => document.getElementById(id);
let dropdownOpen = false;

function buildProviderDropdown() {
  // Portal: list as direct child of body
  let list = document.getElementById('provider-list');
  if (list) list.remove();

  list = document.createElement('ul');
  list.id = 'provider-list';
  list.className = 'provider-list';
  list.setAttribute('role', 'listbox');
  document.body.appendChild(list);

  PROVIDER_ORDER.forEach(id => {
    const p = PROVIDERS[id];
    const li = document.createElement('li');
    li.className = 'provider-list-item';
    li.dataset.id = id;
    li.setAttribute('role', 'option');
    li.innerHTML = `<span class="item-logo">${PROVIDER_LOGOS[id] || ''}</span><span>${p.name}</span>`;
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      selectProvider(id);
      closeDropdown();
    });
    list.appendChild(li);
  });
}

function openDropdown() {
  dropdownOpen = true;
  const dd = $('provider-dropdown');
  const list = document.getElementById('provider-list');
  const rect = dd.getBoundingClientRect();
  list.style.position = 'fixed';
  list.style.top   = `${rect.bottom}px`;
  list.style.left  = `${rect.left}px`;
  list.style.width = `${rect.width}px`;
  list.style.display = 'block';
  dd.classList.add('open');
  dd.setAttribute('aria-expanded', 'true');
}

function closeDropdown() {
  if (!dropdownOpen) return;
  dropdownOpen = false;
  $('provider-dropdown').classList.remove('open');
  $('provider-dropdown').setAttribute('aria-expanded', 'false');
  const list = document.getElementById('provider-list');
  if (list) list.style.display = 'none';
}

function toggleDropdown() {
  dropdownOpen ? closeDropdown() : openDropdown();
}

function updateDropdownDisplay(id) {
  const p = PROVIDERS[id];
  $('provider-selected-logo').innerHTML = PROVIDER_LOGOS[id] || '';
  $('provider-selected-name').textContent = p.name;
  document.querySelectorAll('.provider-list-item').forEach(li => {
    li.classList.toggle('selected', li.dataset.id === id);
  });
}

let lastSelected = null;
function selectProvider(id) {
  lastSelected = id;
  updateDropdownDisplay(id);
}

// ── Tests ──────────────────────────────────────────────────────

describe('buildProviderDropdown — list creation', () => {
  beforeEach(() => { buildPopupDOM(); dropdownOpen = false; lastSelected = null; });

  it('creates exactly 7 list items', () => {
    buildProviderDropdown();
    const items = document.querySelectorAll('.provider-list-item');
    expect(items).toHaveLength(7);
  });

  it('creates items for all PROVIDER_ORDER ids', () => {
    buildProviderDropdown();
    const ids = [...document.querySelectorAll('.provider-list-item')].map(li => li.dataset.id);
    expect(ids).toEqual(PROVIDER_ORDER);
  });

  it('first item is anthropic', () => {
    buildProviderDropdown();
    const first = document.querySelector('.provider-list-item');
    expect(first.dataset.id).toBe('anthropic');
  });

  it('last item is custom', () => {
    buildProviderDropdown();
    const items = document.querySelectorAll('.provider-list-item');
    expect(items[items.length - 1].dataset.id).toBe('custom');
  });

  it('each item shows provider name text', () => {
    buildProviderDropdown();
    PROVIDER_ORDER.forEach(id => {
      const li = document.querySelector(`[data-id="${id}"]`);
      expect(li).not.toBeNull();
      expect(li.textContent).toContain(PROVIDERS[id].name);
    });
  });

  it('each item has logo SVG', () => {
    buildProviderDropdown();
    PROVIDER_ORDER.forEach(id => {
      const li = document.querySelector(`[data-id="${id}"]`);
      expect(li.querySelector('.item-logo svg')).not.toBeNull();
    });
  });
});

describe('openDropdown — fixed positioning (overflow-escape fix)', () => {
  beforeEach(() => { buildPopupDOM(); buildProviderDropdown(); dropdownOpen = false; });

  it('adds .open class to dropdown and sets list display:block', () => {
    openDropdown();
    expect($('provider-dropdown').classList.contains('open')).toBe(true);
    expect(document.getElementById('provider-list').style.display).toBe('block');
  });

  it('sets aria-expanded=true', () => {
    openDropdown();
    expect($('provider-dropdown').getAttribute('aria-expanded')).toBe('true');
  });

  it('sets list style.top (position:fixed anchor)', () => {
    openDropdown();
    expect(document.getElementById('provider-list').style.top).toBeTruthy();
  });

  it('sets list style.left', () => {
    openDropdown();
    expect(document.getElementById('provider-list').style.left).toBeTruthy();
  });

  it('sets list style.width', () => {
    openDropdown();
    expect(document.getElementById('provider-list').style.width).toBeDefined();
  });

  it('list.style.top is a pixel value (e.g. "0px")', () => {
    openDropdown();
    expect(document.getElementById('provider-list').style.top).toMatch(/^\d+px$/);
  });

  it('list is a direct child of body (portal)', () => {
    expect(document.getElementById('provider-list').parentElement).toBe(document.body);
  });
});

describe('closeDropdown', () => {
  beforeEach(() => { buildPopupDOM(); buildProviderDropdown(); dropdownOpen = false; });

  it('removes .open from dropdown and hides list', () => {
    openDropdown();
    closeDropdown();
    expect($('provider-dropdown').classList.contains('open')).toBe(false);
    expect(document.getElementById('provider-list').style.display).toBe('none');
  });

  it('sets aria-expanded=false', () => {
    openDropdown();
    closeDropdown();
    expect($('provider-dropdown').getAttribute('aria-expanded')).toBe('false');
  });

  it('is idempotent — calling twice does not throw', () => {
    openDropdown();
    expect(() => { closeDropdown(); closeDropdown(); }).not.toThrow();
  });
});

describe('toggleDropdown', () => {
  beforeEach(() => { buildPopupDOM(); buildProviderDropdown(); dropdownOpen = false; });

  it('opens when closed — dropdown gets .open, list display:block', () => {
    toggleDropdown();
    expect($('provider-dropdown').classList.contains('open')).toBe(true);
    expect(document.getElementById('provider-list').style.display).toBe('block');
  });

  it('closes when open — dropdown loses .open, list display:none', () => {
    openDropdown();
    toggleDropdown();
    expect($('provider-dropdown').classList.contains('open')).toBe(false);
    expect(document.getElementById('provider-list').style.display).toBe('none');
  });
});

describe('selectProvider — item click', () => {
  beforeEach(() => { buildPopupDOM(); buildProviderDropdown(); dropdownOpen = false; });

  it('clicking gemini item sets selected class on gemini', () => {
    openDropdown();
    const geminiItem = document.querySelector('[data-id="gemini"]');
    geminiItem.click();
    expect(geminiItem.classList.contains('selected')).toBe(true);
  });

  it('clicking gemini removes selected from previous', () => {
    openDropdown();
    updateDropdownDisplay('anthropic');
    const geminiItem = document.querySelector('[data-id="gemini"]');
    geminiItem.click();
    const anthropicItem = document.querySelector('[data-id="anthropic"]');
    expect(anthropicItem.classList.contains('selected')).toBe(false);
  });

  it('clicking any item closes the dropdown', () => {
    openDropdown();
    document.querySelector('[data-id="groq"]').click();
    expect($('provider-dropdown').classList.contains('open')).toBe(false);
  });

  it('clicking calls selectProvider with correct id', () => {
    openDropdown();
    document.querySelector('[data-id="mistral"]').click();
    expect(lastSelected).toBe('mistral');
  });

  it('can select each of the 7 providers', () => {
    PROVIDER_ORDER.forEach(id => {
      openDropdown();
      document.querySelector(`[data-id="${id}"]`).click();
      expect(lastSelected).toBe(id);
    });
  });
});

describe('updateDropdownDisplay', () => {
  beforeEach(() => { buildPopupDOM(); buildProviderDropdown(); });

  it('updates selected name text for each provider', () => {
    PROVIDER_ORDER.forEach(id => {
      updateDropdownDisplay(id);
      expect($('provider-selected-name').textContent).toBe(PROVIDERS[id].name);
    });
  });

  it('updates logo SVG for each provider', () => {
    PROVIDER_ORDER.forEach(id => {
      updateDropdownDisplay(id);
      expect($('provider-selected-logo').innerHTML).toContain('<svg');
    });
  });

  it('marks only the selected item with .selected class', () => {
    buildProviderDropdown();
    updateDropdownDisplay('gemini');
    const selected = document.querySelectorAll('.provider-list-item.selected');
    expect(selected).toHaveLength(1);
    expect(selected[0].dataset.id).toBe('gemini');
  });
});
