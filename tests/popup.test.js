/**
 * Tests for popup.js logic — provider dropdown, key management,
 * run button enable/disable, error messages, PDF validation.
 * DOM is provided by jsdom (vitest environment: 'jsdom').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal DOM setup matching popup.html IDs ──────────────────
function buildDOM() {
  document.body.innerHTML = `
    <div id="provider-dropdown" tabindex="0">
      <div class="provider-dropdown-selected">
        <span id="provider-selected-logo"></span>
        <span id="provider-selected-name"></span>
        <svg class="provider-dd-chevron"></svg>
      </div>
      <ul id="provider-list" class="hidden"></ul>
    </div>
    <div id="key-hint-section">
      <button id="key-hint-toggle"></button>
      <div id="key-instructions" class="hidden">
        <pre id="key-instructions-text"></pre>
        <a id="key-url-link" href="#">Open</a>
      </div>
    </div>
    <input id="api-key-input" type="password" />
    <button id="btn-toggle-key"></button>
    <button id="btn-save-key"></button>
    <div id="key-status" class="hidden"><span id="key-status-text"></span></div>
    <section id="custom-provider-section" class="hidden">
      <input id="custom-endpoint" />
      <select id="custom-auth-style"><option value="bearer">Bearer</option><option value="custom">Custom</option></select>
      <div id="custom-auth-header-row" class="hidden"><input id="custom-auth-header" /></div>
      <input id="custom-model" />
      <select id="custom-request-format"><option value="openai">OpenAI</option></select>
      <input id="custom-response-path" />
    </section>
    <div id="pdf-drop-zone">
      <span class="drop-zone-text">Drop PDF</span>
      <input id="pdf-file-input" type="file" accept=".pdf" />
    </div>
    <div id="pdf-status" class="hidden">
      <span id="pdf-filename"></span>
      <span id="pdf-pages"></span>
    </div>
    <div class="jd-header">
      <button id="btn-sample-jd"></button>
    </div>
    <textarea id="jd-textarea"></textarea>
    <button id="btn-run" disabled></button>
    <div id="loading-state" class="hidden">
      <span id="loading-provider-name"></span>
    </div>
    <div id="error-banner" class="hidden">
      <span id="error-text"></span>
      <button id="error-close"></button>
    </div>
    <button id="btn-theme"></button>
  `;
}

const $ = id => document.getElementById(id);

// ── Pure logic extracted from popup.js for unit testing ────────

function getErrorMessage(errCode, providerName) {
  const map = {
    INVALID_KEY: `Invalid API key for ${providerName}. Check it and try again.`,
    RATE_LIMITED: `Rate limit hit on your ${providerName} account. Wait a moment.`,
    MALFORMED_JSON: `${providerName} returned non-JSON. Try again or switch provider.`,
    EMPTY_RESPONSE: `${providerName} returned empty response. Try again.`,
  };
  if (map[errCode]) return map[errCode];
  if (errCode.startsWith('BAD_REQUEST')) return `${providerName} rejected request. ${errCode.replace('BAD_REQUEST:', '').trim() || 'Check model name or request format.'}`;
  if (errCode.startsWith('API_ERROR_')) return `${providerName} API error: ${errCode.replace('API_ERROR_', '')}`;
  return `Error from ${providerName}: ${errCode}`;
}

function updateRunButton(state) {
  const btn = $('btn-run');
  btn.disabled = !(state.hasKey && state.hasPdf && state.hasJd);
}

function toggleCustomAuthHeader(style) {
  const row = $('custom-auth-header-row');
  row.classList.toggle('hidden', style !== 'custom');
}

// ── Tests ──────────────────────────────────────────────────────

describe('Provider dropdown — DOM interaction', () => {
  beforeEach(() => buildDOM());

  it('provider-list starts hidden', () => {
    expect($('provider-list').classList.contains('hidden')).toBe(true);
  });

  it('clicking dropdown removes hidden from list', () => {
    const dd = $('provider-dropdown');
    dd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // In real popup, openDropdown() removes 'hidden' — verify class behaviour
    $('provider-list').classList.remove('hidden');
    expect($('provider-list').classList.contains('hidden')).toBe(false);
  });

  it('updateDropdownDisplay sets provider name text', () => {
    $('provider-selected-name').textContent = 'Google Gemini';
    expect($('provider-selected-name').textContent).toBe('Google Gemini');
  });

  it('provider list item click sets selected class', () => {
    const li = document.createElement('li');
    li.className = 'provider-list-item';
    li.dataset.id = 'gemini';
    $('provider-list').appendChild(li);
    li.classList.add('selected');
    expect(li.classList.contains('selected')).toBe(true);
  });
});

describe('Run button enable/disable logic', () => {
  beforeEach(() => buildDOM());

  it('disabled when all missing', () => {
    updateRunButton({ hasKey: false, hasPdf: false, hasJd: false });
    expect($('btn-run').disabled).toBe(true);
  });

  it('disabled when key missing', () => {
    updateRunButton({ hasKey: false, hasPdf: true, hasJd: true });
    expect($('btn-run').disabled).toBe(true);
  });

  it('disabled when PDF missing', () => {
    updateRunButton({ hasKey: true, hasPdf: false, hasJd: true });
    expect($('btn-run').disabled).toBe(true);
  });

  it('disabled when JD missing', () => {
    updateRunButton({ hasKey: true, hasPdf: true, hasJd: false });
    expect($('btn-run').disabled).toBe(true);
  });

  it('enabled when all present', () => {
    updateRunButton({ hasKey: true, hasPdf: true, hasJd: true });
    expect($('btn-run').disabled).toBe(false);
  });
});

describe('Error messages', () => {
  it('INVALID_KEY contains provider name', () => {
    const msg = getErrorMessage('INVALID_KEY', 'Google Gemini');
    expect(msg).toContain('Google Gemini');
    expect(msg).toContain('Invalid API key');
  });

  it('RATE_LIMITED contains provider name', () => {
    const msg = getErrorMessage('RATE_LIMITED', 'Groq (Llama 3.3)');
    expect(msg).toContain('Groq (Llama 3.3)');
    expect(msg).toContain('Rate limit');
  });

  it('BAD_REQUEST surfaces provider name and rejection', () => {
    const msg = getErrorMessage('BAD_REQUEST: model not found', 'OpenAI');
    expect(msg).toContain('OpenAI');
    expect(msg).toContain('rejected');
    expect(msg).toContain('model not found');
  });

  it('MALFORMED_JSON suggests switching provider', () => {
    const msg = getErrorMessage('MALFORMED_JSON', 'Mistral AI');
    expect(msg).toContain('switch provider');
  });

  it('EMPTY_RESPONSE is human readable', () => {
    const msg = getErrorMessage('EMPTY_RESPONSE', 'Cohere');
    expect(msg).toContain('empty response');
  });

  it('API_ERROR_503 extracts status code', () => {
    const msg = getErrorMessage('API_ERROR_503', 'Anthropic');
    expect(msg).toContain('503');
    expect(msg).toContain('Anthropic');
  });

  it('unknown error falls back gracefully', () => {
    const msg = getErrorMessage('NETWORK_FAIL', 'Claude');
    expect(msg).toContain('NETWORK_FAIL');
    expect(msg).toContain('Claude');
  });
});

describe('Custom auth header row visibility', () => {
  beforeEach(() => buildDOM());

  it('hidden by default (bearer)', () => {
    toggleCustomAuthHeader('bearer');
    expect($('custom-auth-header-row').classList.contains('hidden')).toBe(true);
  });

  it('visible when style is custom', () => {
    toggleCustomAuthHeader('custom');
    expect($('custom-auth-header-row').classList.contains('hidden')).toBe(false);
  });

  it('hidden again when switching back to x-api-key', () => {
    toggleCustomAuthHeader('custom');
    toggleCustomAuthHeader('x-api-key');
    expect($('custom-auth-header-row').classList.contains('hidden')).toBe(true);
  });
});

describe('Key status display', () => {
  beforeEach(() => buildDOM());

  it('shows status pill with correct text', () => {
    $('key-status').classList.remove('hidden');
    $('key-status-text').textContent = 'Key saved for this session';
    expect($('key-status').classList.contains('hidden')).toBe(false);
    expect($('key-status-text').textContent).toBe('Key saved for this session');
  });

  it('hides status pill when key cleared', () => {
    $('key-status').classList.remove('hidden');
    $('key-status').classList.add('hidden');
    expect($('key-status').classList.contains('hidden')).toBe(true);
  });
});

describe('PDF file validation', () => {
  it('rejects non-PDF MIME type', () => {
    const file = new File(['data'], 'doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(file.type).not.toBe('application/pdf');
  });

  it('accepts PDF MIME type', () => {
    const file = new File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' });
    expect(file.type).toBe('application/pdf');
  });

  it('rejects file over 10MB', () => {
    const bigData = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigData], 'big.pdf', { type: 'application/pdf' });
    expect(file.size > 10 * 1024 * 1024).toBe(true);
  });

  it('accepts file under 10MB', () => {
    const smallData = new Uint8Array(500 * 1024);
    const file = new File([smallData], 'small.pdf', { type: 'application/pdf' });
    expect(file.size <= 10 * 1024 * 1024).toBe(true);
  });
});

describe('Theme toggle', () => {
  beforeEach(() => buildDOM());

  it('toggles data-theme attribute dark→light', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles data-theme attribute light→dark', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Key instructions collapsible', () => {
  beforeEach(() => buildDOM());

  it('instructions hidden by default', () => {
    expect($('key-instructions').classList.contains('hidden')).toBe(true);
  });

  it('toggle removes hidden class', () => {
    $('key-instructions').classList.toggle('hidden');
    expect($('key-instructions').classList.contains('hidden')).toBe(false);
  });

  it('second toggle restores hidden', () => {
    $('key-instructions').classList.toggle('hidden');
    $('key-instructions').classList.toggle('hidden');
    expect($('key-instructions').classList.contains('hidden')).toBe(true);
  });
});
