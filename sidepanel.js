import { PROVIDERS, PROVIDER_LOGOS } from './lib/providers.js';
import { saveAnalysis, getHistory, clearHistory, timeAgo } from './lib/history.js';
import { exportReport } from './lib/exportPdf.js';

const $ = id => document.getElementById(id);

let currentResult = null;
let currentPayload = null;
let currentPage = 0;

function init() {
  restoreTheme();
  bindStaticEvents();
  loadPendingResult();
  listenForMessages();
}

function restoreTheme() {
  const saved = localStorage.getItem('ats_scout_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function bindStaticEvents() {
  $('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ats_scout_theme', next);
  });

  $('btn-history').addEventListener('click', toggleHistory);
  $('btn-close-history').addEventListener('click', () => $('history-panel').classList.add('hidden'));
  $('btn-clear-history').addEventListener('click', async () => {
    await clearHistory();
    renderHistoryList([]);
  });

  $('btn-export').addEventListener('click', () => {
    if (!currentResult || !currentPayload) return;
    exportReport({
      result: currentResult,
      fileName: currentPayload.fileName || 'resume',
      providerName: currentPayload.providerName || 'Unknown'
    });
  });

  $('btn-prev-page').addEventListener('click', () => navigatePage(-1));
  $('btn-next-page').addEventListener('click', () => navigatePage(1));
}

async function loadPendingResult() {
  const data = await chrome.storage.session.get(['ats_scout_pending_result']);
  if (data.ats_scout_pending_result) {
    renderResults(data.ats_scout_pending_result);
  }
}

function listenForMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RENDER_RESULTS') {
      renderResults(message.payload);
    }
    if (message.type === 'SHOW_ERROR') {
      showGlobalError(message.payload);
    }
  });
}

async function renderResults(payload) {
  currentPayload = payload;
  currentResult = payload.result;

  $('empty-state').classList.add('hidden');
  $('results-layout').classList.remove('hidden');

  renderProviderBadge(payload.providerId, payload.providerName);
  renderPdfViewer(payload.pageCanvasDataUrls, payload.lineBoxes, payload.result.ai_detected_lines || []);
  renderScores(payload.result);
  renderHRPerspective(payload.result.hr_perspective);
  renderAuthenticity(payload.result);
  renderExperienceRealism(payload.result.experience_realism, payload.result.unverifiable_claims);
  renderFlaggedPatterns(payload.result.flagged_patterns || []);
  renderMissingKeywords(payload.result.ats_missing_keywords || []);
  renderSuggestions(payload.result.suggestions || []);

  await saveAnalysis({
    fileName: payload.fileName,
    resumeText: payload.resumeText,
    jobDescription: payload.jobDescription,
    providerId: payload.providerId,
    providerName: payload.providerName,
    result: payload.result
  });
}

function renderProviderBadge(providerId, providerName) {
  const badge = $('provider-badge');
  const logo = PROVIDER_LOGOS[providerId] || PROVIDER_LOGOS.custom;
  badge.innerHTML = `${logo}<span>Analysed with ${providerName}</span>`;
  badge.classList.remove('hidden');
}

function renderPdfViewer(pageDataUrls, lineBoxes, aiLines) {
  const container = $('pdf-pages-container');
  container.innerHTML = '';
  currentPage = 0;

  if (!pageDataUrls || pageDataUrls.length === 0) return;

  pageDataUrls.forEach((dataUrl, pageIdx) => {
    const wrap = document.createElement('div');
    wrap.className = 'pdf-page-wrap';
    wrap.dataset.page = pageIdx;

    const img = document.createElement('img');
    img.className = 'pdf-page-img';
    img.src = dataUrl;
    img.alt = `Page ${pageIdx + 1}`;
    wrap.appendChild(img);

    img.addEventListener('load', () => {
      const scaleX = img.offsetWidth / img.naturalWidth;
      const scaleY = img.offsetHeight / img.naturalHeight;
      addHighlights(wrap, img, lineBoxes[pageIdx] || [], aiLines, scaleX, scaleY, pageIdx);
    });

    container.appendChild(wrap);
  });

  if (pageDataUrls.length > 1) {
    $('page-nav').classList.remove('hidden');
    updatePageNav(pageDataUrls.length);
  }
}

function addHighlights(wrap, img, pageLines, aiLines, scaleX, scaleY, pageIdx) {
  aiLines.forEach((aiLine) => {
    const matched = fuzzyMatchLine(aiLine.text, pageLines);
    if (!matched) return;

    const div = document.createElement('div');
    div.className = `highlight-overlay ${aiLine.severity}`;
    div.style.left = `${matched.x * scaleX}px`;
    div.style.top = `${matched.y * scaleY}px`;
    div.style.width = `${matched.width * scaleX}px`;
    div.style.height = `${Math.max(matched.height * scaleY, 14)}px`;
    div.title = `[${aiLine.severity.toUpperCase()}] ${aiLine.pattern} — ${aiLine.text.substring(0, 80)}`;

    div.addEventListener('click', () => {
      div.classList.add('pulsing');
      setTimeout(() => div.classList.remove('pulsing'), 700);
      scrollToMatchingSuggestion(aiLine.text);
    });

    wrap.appendChild(div);
  });
}

function fuzzyMatchLine(targetText, pageLines) {
  if (!pageLines || pageLines.length === 0) return null;
  const targetTokens = tokenize(targetText);
  if (targetTokens.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0.74;

  for (const line of pageLines) {
    const lineTokens = tokenize(line.text);
    if (lineTokens.length === 0) continue;
    const overlap = targetTokens.filter(t => lineTokens.includes(t)).length;
    const score = overlap / Math.max(targetTokens.length, lineTokens.length);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = line;
    }
  }
  return bestMatch;
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
}

function navigatePage(delta) {
  const pages = document.querySelectorAll('.pdf-page-wrap');
  const total = pages.length;
  if (total <= 1) return;
  currentPage = Math.max(0, Math.min(total - 1, currentPage + delta));
  pages[currentPage].scrollIntoView({ behavior: 'smooth', block: 'start' });
  updatePageNav(total);
}

function updatePageNav(total) {
  $('page-indicator').textContent = `${currentPage + 1} / ${total}`;
}

function renderScores(result) {
  const before = result.ats_score_before || 0;
  const after = result.ats_score_after || 0;
  const delta = after - before;

  $('score-before-val').textContent = before;
  $('score-after-val').textContent = after;
  $('score-delta-val').textContent = `+${delta}`;
  $('verdict-summary').textContent = result.verdict_summary || '';

  const CIRC = 201.06;
  setTimeout(() => {
    const ringBefore = $('ring-before');
    const offsetBefore = CIRC - (before / 100) * CIRC;
    ringBefore.style.transition = 'stroke-dashoffset 1s ease';
    ringBefore.style.strokeDashoffset = offsetBefore;

    const ringAfter = $('ring-after');
    const offsetAfter = CIRC - (after / 100) * CIRC;
    ringAfter.style.transition = 'stroke-dashoffset 1s ease';
    ringAfter.style.strokeDashoffset = offsetAfter;
  }, 200);

  if (before >= 88) {
    $('submit-ready-banner').classList.remove('hidden');
    $('submit-ready-text').textContent = `Your resume is already submit-ready (${before}/100). A few optional polishes below — don't chase 100.`;
  }
}

function renderHRPerspective(hr) {
  if (!hr) return;
  const verdictMap = {
    strong_yes: 'STRONG YES',
    yes: 'YES',
    maybe: 'MAYBE',
    no: 'NO'
  };
  const pill = $('hr-verdict-pill');
  pill.textContent = verdictMap[hr.verdict] || hr.verdict;
  pill.className = `hr-verdict-pill verdict-${hr.verdict}`;

  $('hr-first-impression').textContent = hr.first_impression || '';
  $('hr-reasoning').textContent = hr.reasoning || '';

  const strengthsEl = $('hr-strengths');
  if (hr.strengths?.length) {
    strengthsEl.innerHTML = hr.strengths.map(s => `
      <div class="hr-list-item">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#10b981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${escHtml(s)}</span>
      </div>
    `).join('');
  }

  const redFlagsEl = $('hr-red-flags');
  if (hr.red_flags?.length) {
    redFlagsEl.innerHTML = hr.red_flags.map(r => `
      <div class="hr-list-item">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span>${escHtml(r)}</span>
      </div>
    `).join('');
  }
}

function renderAuthenticity(result) {
  $('auth-score-val').textContent = result.authenticity_score ?? '—';

  const dims = result.dimension_scores || {};
  const goodDims = ['specificity', 'seniority_realism', 'technical_depth', 'style_entropy', 'verifiability'];
  const badDims = ['buzzword_density', 'semantic_redundancy', 'ats_manipulation'];

  const barsEl = $('dimension-bars');
  barsEl.innerHTML = Object.entries(dims).map(([key, val], i) => {
    const isGood = goodDims.includes(key);
    const isBad = badDims.includes(key);
    const colorClass = isBad ? 'bad' : (isGood ? 'good' : 'neutral');
    const label = key.replace(/_/g, ' ');
    return `
      <div class="dim-row" style="--i:${i}">
        <div class="dim-label-row">
          <span class="dim-label">${label}</span>
          <span class="dim-val">${val}</span>
        </div>
        <div class="dim-bar-track">
          <div class="dim-bar-fill ${colorClass}" style="--target-width:${val}%; --i:${i}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderExperienceRealism(exp, unverifiable) {
  if (!exp) return;
  const content = $('exp-realism-content');

  const yoeText = exp.stated_yoe != null ? `${exp.stated_yoe} YOE` : 'YOE unknown';
  const mismatchClass = `mismatch-${exp.mismatch_severity || 'none'}`;
  const mismatchText = (exp.mismatch_severity || 'none').toUpperCase();

  content.innerHTML = `
    <div class="exp-meta-row">
      <span class="exp-meta-chip">${escHtml(yoeText)}</span>
      <span class="exp-meta-chip">${escHtml(exp.implied_seniority || '—')}</span>
      <span class="mismatch-badge ${mismatchClass}">${mismatchText}</span>
    </div>
    <div class="exp-evidence">
      ${(exp.evidence || []).map(e => `<div class="exp-evidence-item">${escHtml(e)}</div>`).join('')}
    </div>
  `;

  const unverifiableList = $('unverifiable-list');
  if (unverifiable?.length) {
    unverifiableList.innerHTML = unverifiable.map(u => `
      <div class="unverifiable-claim-item">
        <div class="claim-text">${escHtml(u.claim)}</div>
        ${(u.probing_questions || []).map(q => `<div class="probing-question">${escHtml(q)}</div>`).join('')}
      </div>
    `).join('');
  } else {
    $('unverifiable-claims').classList.add('hidden');
  }
}

function renderFlaggedPatterns(patterns) {
  const list = $('patterns-list');
  if (!patterns.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No flagged patterns detected.</p>';
    return;
  }
  list.innerHTML = patterns.map(p => `
    <div class="pattern-card">
      <div class="pattern-card-header">
        <span class="pattern-name">${escHtml(p.name)}</span>
        <span class="pattern-category">${escHtml(p.category || '')}</span>
        <span class="severity-badge ${p.severity}">${p.severity?.toUpperCase()}</span>
      </div>
      <p class="pattern-examples">${(p.examples || []).map(e => `"${escHtml(e)}"`).join(', ')}</p>
      <p class="pattern-why">${escHtml(p.why_it_matters || '')}</p>
    </div>
  `).join('');
}

function renderMissingKeywords(keywords) {
  const chips = $('keywords-chips');
  if (!keywords.length) {
    chips.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No missing keywords identified.</p>';
    return;
  }
  chips.innerHTML = keywords.map(k => `<span class="keyword-chip">${escHtml(k)}</span>`).join('');
}

function renderSuggestions(suggestions) {
  const required = suggestions.filter(s => s.priority === 'required');
  const optional = suggestions.filter(s => s.priority === 'optional');

  renderSuggestionList($('rewrites-required-list'), required, 0);

  const optionalSection = $('rewrites-optional-section');
  if (optional.length) {
    $('optional-count-badge').textContent = optional.length;
    renderSuggestionList($('rewrites-optional-list'), optional, required.length);
    optionalSection.classList.remove('hidden');
  } else {
    optionalSection.classList.add('hidden');
  }
}

function renderSuggestionList(container, suggestions, startIdx) {
  if (!suggestions.length) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No suggestions in this category.</p>';
    return;
  }
  container.innerHTML = suggestions.map((s, i) => `
    <div class="suggestion-card" data-original="${escAttr(s.original)}" style="--i:${i}">
      <div class="suggestion-header">
        <span class="suggestion-num">REWRITE #${startIdx + i + 1}</span>
        <span class="pts-badge">+${s.impact_points} pts</span>
        ${s.priority === 'optional' ? '<span class="optional-tag">OPTIONAL</span>' : ''}
        <button class="copy-btn" data-copy="${escAttr(s.improved)}">Copy</button>
      </div>
      <div class="suggestion-body">
        <div class="suggestion-before">${escHtml(s.original)}</div>
        <div class="suggestion-after">${escHtml(s.improved)}</div>
        <div class="suggestion-reason">${escHtml(s.reason)}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-btn')) {
        const text = e.target.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
        });
        return;
      }
      const original = card.dataset.original;
      scrollToHighlight(original);
    });
  });
}

function scrollToHighlight(originalText) {
  const tokens = tokenize(originalText);
  if (!tokens.length) return;

  const overlays = document.querySelectorAll('.highlight-overlay');
  for (const overlay of overlays) {
    const titleTokens = tokenize(overlay.title);
    const overlap = tokens.filter(t => titleTokens.includes(t)).length;
    if (overlap / tokens.length >= 0.5) {
      overlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
      overlay.classList.add('pulsing');
      setTimeout(() => overlay.classList.remove('pulsing'), 700);
      break;
    }
  }
}

function scrollToMatchingSuggestion(text) {
  const tokens = tokenize(text);
  const cards = document.querySelectorAll('.suggestion-card');
  for (const card of cards) {
    const original = card.dataset.original || '';
    const cardTokens = tokenize(original);
    const overlap = tokens.filter(t => cardTokens.includes(t)).length;
    if (overlap / Math.max(tokens.length, 1) >= 0.5) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.borderColor = 'var(--amber)';
      setTimeout(() => { card.style.borderColor = ''; }, 1200);
      break;
    }
  }
}

async function toggleHistory() {
  const panel = $('history-panel');
  if (panel.classList.contains('hidden')) {
    const entries = await getHistory();
    renderHistoryList(entries);
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function renderHistoryList(entries) {
  const list = $('history-list');
  if (!entries.length) {
    list.innerHTML = '<div class="history-empty">No history yet.</div>';
    return;
  }
  list.innerHTML = entries.map(entry => `
    <div class="history-item" data-id="${entry.id}">
      <div class="history-item-header">
        <span class="history-filename">${escHtml(entry.fileName || 'Unknown')}</span>
        <span class="history-time">${timeAgo(entry.createdAt)}</span>
      </div>
      <div class="history-meta">
        <span class="history-provider">
          ${PROVIDER_LOGOS[entry.providerId] || ''}
          ${escHtml(entry.providerName || entry.providerId)}
        </span>
        <span class="history-scores">${entry.result?.ats_score_before ?? '?'} → ${entry.result?.ats_score_after ?? '?'}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      const all = await getHistory();
      const entry = all.find(e => e.id === id);
      if (entry) {
        $('history-panel').classList.add('hidden');
        renderResults({
          result: entry.result,
          fileName: entry.fileName,
          pageCanvasDataUrls: [],
          lineBoxes: [],
          providerId: entry.providerId,
          providerName: entry.providerName,
          resumeText: entry.resumeText,
          jobDescription: entry.jobDescription
        });
      }
    });
  });
}

function showGlobalError(payload) {
  $('empty-state').classList.remove('hidden');
  $('results-layout').classList.add('hidden');
  const subtitle = document.querySelector('.empty-subtitle');
  if (subtitle) subtitle.textContent = `Analysis failed: ${payload?.message || 'Unknown error'}`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

init();
