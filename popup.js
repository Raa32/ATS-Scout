import { PROVIDERS, PROVIDER_ORDER, PROVIDER_LOGOS } from './lib/providers.js';
import { analyzeResume } from './lib/llm.js';
import { parsePdf } from './lib/pdfUtils.js';

const SAMPLE_JD = `Senior Software Engineer — Full Stack
We are looking for a Senior Software Engineer to join our product team. You will design and build scalable web services, own features end-to-end, and mentor junior engineers.

Requirements:
- 5+ years of software engineering experience
- Proficiency in TypeScript/JavaScript, React, Node.js
- Experience with cloud platforms (AWS, GCP, or Azure)
- Familiarity with containerization (Docker, Kubernetes)
- Strong understanding of REST APIs and microservices architecture
- Experience with PostgreSQL or similar relational databases
- Track record of shipping features with measurable impact
- Excellent communication and collaboration skills

Nice to have:
- Experience with GraphQL
- Knowledge of CI/CD pipelines (GitHub Actions, Jenkins)
- Open source contributions
- Experience with performance optimization and observability (Datadog, Sentry)

We value engineers who can identify problems, propose solutions, and execute with autonomy. We ship fast and measure impact rigorously.`;

let currentProviderId = 'anthropic';
let parsedPdfData = null;
let abortController = null;
let dropdownOpen = false;

const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────
function init() {
  restoreTheme();
  buildProviderDropdown();
  loadProviderFromSession();
  bindEvents();
}

// ── Custom Dropdown ───────────────────────────────────────────
function buildProviderDropdown() {
  // Portal: list lives as direct child of body so no ancestor overflow clips it
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
  // position:fixed relative to viewport — coordinates from getBoundingClientRect
  list.style.position = 'fixed';
  list.style.top    = `${rect.bottom}px`;
  list.style.left   = `${rect.left}px`;
  list.style.width  = `${rect.width}px`;
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

async function selectProvider(id) {
  currentProviderId = id;
  await chrome.storage.session.set({ ats_scout_provider: id });
  updateDropdownDisplay(id);
  await updateProviderUI(id);
  hideError();
}

function updateDropdownDisplay(id) {
  const p = PROVIDERS[id];
  $('provider-selected-logo').innerHTML = PROVIDER_LOGOS[id] || '';
  $('provider-selected-name').textContent = p.name;

  // Update selected state on list items
  document.querySelectorAll('.provider-list-item').forEach(li => {
    li.classList.toggle('selected', li.dataset.id === id);
  });
}

// ── Provider UI ───────────────────────────────────────────────
async function loadProviderFromSession() {
  const data = await chrome.storage.session.get(['ats_scout_provider']);
  const saved = data.ats_scout_provider || 'anthropic';
  currentProviderId = saved;
  updateDropdownDisplay(saved);
  await updateProviderUI(saved);
}

async function updateProviderUI(providerId) {
  const provider = PROVIDERS[providerId];
  const keyHintToggle = $('key-hint-toggle');

  if (provider.keyInstructions) {
    keyHintToggle.style.display = 'flex';
    $('key-instructions-text').textContent = provider.keyInstructions;
    if (provider.keyUrl) {
      $('key-url-link').href = provider.keyUrl;
      $('key-url-link').style.display = 'inline';
    } else {
      $('key-url-link').style.display = 'none';
    }
  } else {
    keyHintToggle.style.display = 'none';
  }

  const keyInput = $('api-key-input');
  keyInput.placeholder = provider.keyHint || 'Paste your API key...';

  // Load saved key for this provider
  const savedKeyData = await chrome.storage.session.get([`ats_scout_key_${providerId}`]);
  const savedKey = savedKeyData[`ats_scout_key_${providerId}`];
  keyInput.value = savedKey || '';
  showKeyStatus(!!savedKey);

  // Custom provider config panel
  if (providerId === 'custom') {
    $('custom-provider-section').classList.remove('hidden');
    await loadCustomConfig();
  } else {
    $('custom-provider-section').classList.add('hidden');
  }

  // Collapse key instructions on provider switch
  $('key-instructions').classList.add('hidden');

  updateRunButton();
}

// ── Key Status ────────────────────────────────────────────────
function showKeyStatus(show, text = 'Key saved for this session') {
  const el = $('key-status');
  if (show) {
    el.classList.remove('hidden');
    $('key-status-text').textContent = text;
  } else {
    el.classList.add('hidden');
  }
}

// ── Custom Provider Config ────────────────────────────────────
async function loadCustomConfig() {
  const data = await chrome.storage.session.get(['ats_scout_custom_provider']);
  const cc = data.ats_scout_custom_provider || {};
  if (cc.endpoint) $('custom-endpoint').value = cc.endpoint;
  if (cc.authStyle) {
    $('custom-auth-style').value = cc.authStyle;
    toggleCustomAuthHeader(cc.authStyle);
  }
  if (cc.authHeaderName) $('custom-auth-header').value = cc.authHeaderName;
  if (cc.model) $('custom-model').value = cc.model;
  if (cc.requestFormat) $('custom-request-format').value = cc.requestFormat;
  if (cc.responsePath) $('custom-response-path').value = cc.responsePath;
}

async function saveCustomConfig() {
  const cc = {
    endpoint: $('custom-endpoint').value.trim(),
    authStyle: $('custom-auth-style').value,
    authHeaderName: $('custom-auth-header').value.trim(),
    model: $('custom-model').value.trim(),
    requestFormat: $('custom-request-format').value,
    responsePath: $('custom-response-path').value.trim()
  };
  await chrome.storage.session.set({ ats_scout_custom_provider: cc });
  return cc;
}

function toggleCustomAuthHeader(style) {
  const row = $('custom-auth-header-row');
  row.classList.toggle('hidden', style !== 'custom');
}

// ── Run Button ────────────────────────────────────────────────
function updateRunButton() {
  const hasKey = $('api-key-input').value.trim().length > 0;
  const hasPdf = parsedPdfData !== null;
  const hasJd = $('jd-textarea').value.trim().length > 0;
  $('btn-run').disabled = !(hasKey && hasPdf && hasJd);
}

// ── Errors ────────────────────────────────────────────────────
function showError(msg) {
  $('error-text').textContent = msg;
  $('error-banner').classList.remove('hidden');
}
function hideError() { $('error-banner').classList.add('hidden'); }

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

// ── Theme ─────────────────────────────────────────────────────
function restoreTheme() {
  const saved = localStorage.getItem('ats_scout_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

// ── Event Bindings ────────────────────────────────────────────
function bindEvents() {
  // Custom dropdown
  $('provider-dropdown').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
  $('provider-dropdown').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDropdown(); }
    if (e.key === 'Escape') closeDropdown();
  });
  document.addEventListener('click', () => closeDropdown());

  // Key hint collapsible
  $('key-hint-toggle').addEventListener('click', () => {
    $('key-instructions').classList.toggle('hidden');
  });

  // API key input
  $('api-key-input').addEventListener('input', updateRunButton);
  $('btn-toggle-key').addEventListener('click', () => {
    const input = $('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Save key
  const saveKey = async () => {
    const key = $('api-key-input').value.trim();
    if (!key) return;
    await chrome.storage.session.set({ [`ats_scout_key_${currentProviderId}`]: key });
    showKeyStatus(true);
    updateRunButton();
  };
  $('btn-save-key').addEventListener('click', saveKey);
  $('api-key-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKey(); });

  // Custom config fields
  $('custom-auth-style').addEventListener('change', (e) => toggleCustomAuthHeader(e.target.value));
  ['custom-endpoint','custom-auth-style','custom-auth-header','custom-model','custom-request-format','custom-response-path'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', saveCustomConfig);
    el.addEventListener('change', saveCustomConfig);
  });

  // PDF drop zone — <label for="pdf-file-input"> natively opens picker, no JS click needed
  const dropZone = $('pdf-drop-zone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handlePdfFile(file);
  });
  // File input change listener (input is sibling, not child — survives dropZone.innerHTML rebuild)
  $('pdf-file-input').addEventListener('change', (e) => { if (e.target.files[0]) handlePdfFile(e.target.files[0]); });

  // JD
  $('jd-textarea').addEventListener('input', updateRunButton);
  $('jd-textarea').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !$('btn-run').disabled) runAnalysis();
  });
  $('btn-sample-jd').addEventListener('click', () => {
    $('jd-textarea').value = SAMPLE_JD;
    updateRunButton();
  });

  // Run + error dismiss + theme
  $('btn-run').addEventListener('click', runAnalysis);
  $('error-close').addEventListener('click', hideError);
  $('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ats_scout_theme', next);
  });
}

// ── PDF Handling ──────────────────────────────────────────────
async function handlePdfFile(file) {
  if (file.type !== 'application/pdf') { showError('Only PDF files are supported.'); return; }
  if (file.size > 10 * 1024 * 1024) { showError('PDF must be under 10MB.'); return; }
  hideError();

  const dropZone = $('pdf-drop-zone');
  dropZone.querySelector('.drop-zone-text') && (dropZone.querySelector('.drop-zone-text').textContent = 'Parsing PDF...');

  try {
    const result = await parsePdf(file);
    parsedPdfData = { ...result, fileName: file.name };

    dropZone.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="var(--emerald)" stroke-width="1.5"/>
        <polyline points="14 2 14 8 20 8" stroke="var(--emerald)" stroke-width="1.5"/>
      </svg>
      <span style="font-size:12px;color:var(--emerald);">PDF ready — ${file.name}</span>
      <span style="font-size:10px;color:var(--text-muted);">Click to replace</span>
    `;

    $('pdf-status').classList.remove('hidden');
    $('pdf-filename').textContent = file.name;
    $('pdf-pages').textContent = `· ${result.pageCanvasDataUrls.length} page${result.pageCanvasDataUrls.length !== 1 ? 's' : ''}`;
    updateRunButton();
  } catch (err) {
    showError(`Failed to parse PDF: ${err.message}`);
    parsedPdfData = null;
    resetDropZone();
    updateRunButton();
  }
}

function resetDropZone() {
  const dropZone = $('pdf-drop-zone');
  dropZone.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <polyline points="9 15 12 12 15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="drop-zone-text">Drop PDF here or <span class="browse-link">Browse</span></span>
  `;
}

// ── Run Analysis ──────────────────────────────────────────────
async function runAnalysis() {
  if ($('btn-run').disabled) return;
  hideError();

  const apiKey = $('api-key-input').value.trim();
  const jd = $('jd-textarea').value.trim();
  const provider = PROVIDERS[currentProviderId];

  let customConfig = null;
  if (currentProviderId === 'custom') {
    customConfig = await saveCustomConfig();
    if (!customConfig.endpoint || !customConfig.model || !customConfig.responsePath) {
      showError('Custom provider: fill Endpoint URL, Model Name, and Response Path.');
      return;
    }
  }

  $('btn-run').classList.add('hidden');
  $('loading-state').classList.remove('hidden');
  $('loading-provider-name').textContent = provider?.name || 'AI';

  abortController = new AbortController();

  try {
    const result = await analyzeResume({
      providerId: currentProviderId,
      apiKey,
      resumeText: parsedPdfData.text,
      jobDescription: jd,
      customConfig,
      signal: abortController.signal
    });

    const payload = {
      result,
      fileName: parsedPdfData.fileName,
      pageCanvasDataUrls: parsedPdfData.pageCanvasDataUrls,
      lineBoxes: parsedPdfData.lineBoxes,
      providerId: currentProviderId,
      providerName: provider?.name || currentProviderId,
      resumeText: parsedPdfData.text,
      jobDescription: jd
    };

    await chrome.storage.session.set({ ats_scout_pending_result: payload });
    chrome.runtime.sendMessage({ type: 'ANALYSIS_COMPLETE', payload });

    // Open side panel
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id });
    } catch (e) {
      // sidePanel.open may fail in some contexts — side panel will still load on next open
      console.warn('Could not auto-open side panel:', e.message);
    }

    window.close();
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(getErrorMessage(err.message, provider?.name || currentProviderId));
  } finally {
    $('btn-run').classList.remove('hidden');
    $('loading-state').classList.add('hidden');
  }
}

init();
