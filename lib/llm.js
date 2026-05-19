import { PROVIDERS, resolvePath } from './providers.js';

/**
 * Provider-agnostic resume analysis call.
 *
 * @param {object} opts
 * @param {string} opts.providerId
 * @param {string} opts.apiKey
 * @param {string} opts.resumeText
 * @param {string} opts.jobDescription
 * @param {object} [opts.customConfig]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<object>}
 */
export async function analyzeResume({ providerId, apiKey, resumeText, jobDescription, customConfig, signal }) {
  const provider = PROVIDERS[providerId];
  const cfg = providerId === 'custom' ? buildCustomConfig(customConfig) : provider;
  const systemPrompt = getSystemPrompt();
  const userMessage = buildUserMessage(resumeText, jobDescription);
  const { url, headers, body } = buildRequest(cfg, apiKey, systemPrompt, userMessage);

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body)
  });

  await handleHttpErrors(response);
  const data = await response.json();
  const raw = resolvePath(data, cfg.responsePath);
  if (!raw) throw new Error('EMPTY_RESPONSE');

  const clean = String(raw).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('MALFORMED_JSON');
  }
}

function buildRequest(cfg, apiKey, systemPrompt, userMessage) {
  let url = cfg.endpoint;
  const headers = { 'Content-Type': 'application/json', ...(cfg.extraHeaders || {}) };
  let body;

  if (cfg.authStyle === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (cfg.authStyle === 'x-api-key') {
    headers['x-api-key'] = apiKey;
  } else if (cfg.authStyle === 'url-param') {
    url = `${url}?key=${encodeURIComponent(apiKey)}`;
  } else if (cfg.authStyle === 'custom') {
    headers[cfg.authHeaderName] = apiKey;
  }

  if (cfg.requestFormat === 'anthropic') {
    body = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 4096,
      temperature: cfg.temperature ?? 0.35,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      ...(cfg.extraBody || {})
    };
  } else if (cfg.requestFormat === 'openai') {
    body = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 4096,
      temperature: cfg.temperature ?? 0.35,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      ...(cfg.extraBody || {})
    };
  } else if (cfg.requestFormat === 'gemini') {
    body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
        }
      ],
      ...(cfg.extraBody || {})
    };
  } else if (cfg.requestFormat === 'cohere') {
    body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      ...(cfg.extraBody || {})
    };
  }

  return { url, headers, body };
}

async function handleHttpErrors(response) {
  if (response.ok) return;
  let detail = '';
  try {
    const text = await response.clone().text();
    detail = text.slice(0, 500);
    console.error('API error response:', response.status, detail);
  } catch {}
  if (response.status === 401 || response.status === 403) throw new Error('INVALID_KEY');
  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (response.status === 400) throw new Error(`BAD_REQUEST: ${detail}`);
  throw new Error(`API_ERROR_${response.status}: ${detail}`);
}

function buildCustomConfig(cc) {
  return {
    endpoint: cc.endpoint,
    authStyle: cc.authStyle,
    authHeaderName: cc.authHeaderName,
    model: cc.model,
    requestFormat: cc.requestFormat,
    responsePath: cc.responsePath,
    maxTokens: 4096,
    temperature: 0.35,
    extraHeaders: {},
    extraBody: {}
  };
}

function buildUserMessage(resumeText, jobDescription) {
  return `JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n\nRESUME:\n"""\n${resumeText}\n"""\n\nReturn the JSON analysis now.`;
}

function getSystemPrompt() {
  return `You are the strictest possible resume authenticity auditor. You analyse resumes for AI-generated language, seniority inflation, semantic redundancy, low specificity, ATS manipulation, and emotional/stylistic flatness.
You MUST return ONLY valid JSON. No markdown fences, no commentary, no preamble — raw JSON only.
Schema:
{
  "ats_score_before": <int 0-100>,
  "ats_score_after": <int 0-100>,
  "authenticity_score": <int 0-100>,
  "verdict_summary": "<one brutal sentence>",
  "dimension_scores": {
    "buzzword_density": <int 0-100, higher = worse>,
    "specificity": <int 0-100, higher = better>,
    "seniority_realism": <int 0-100, higher = better>,
    "technical_depth": <int 0-100, higher = better>,
    "semantic_redundancy": <int 0-100, higher = worse>,
    "style_entropy": <int 0-100, higher = better>,
    "verifiability": <int 0-100, higher = better>,
    "ats_manipulation": <int 0-100, higher = worse>
  },
  "ai_detected_lines": [
    { "text": "<verbatim line>", "severity": "high|medium|low",
      "pattern": "buzzword|inflated_seniority|vague_impact|redundancy|unrealistic_scope|low_specificity|uniform_rhythm|ats_stuffing" }
  ],
  "flagged_patterns": [
    { "name": "<short name>", "category": "<category>", "severity": "high|medium|low",
      "examples": ["..."], "why_it_matters": "<one sentence>" }
  ],
  "experience_realism": {
    "stated_yoe": <number | null>,
    "implied_seniority": "junior|mid|senior|staff|principal",
    "mismatch_severity": "none|mild|moderate|severe",
    "evidence": ["..."]
  },
  "unverifiable_claims": [
    { "claim": "<verbatim>", "probing_questions": ["..."] }
  ],
  "ats_missing_keywords": ["..."],
  "suggestions": [
    {
      "original": "<verbatim line>",
      "improved": "<stronger quantified rewrite incorporating missing keywords>",
      "reason": "<why>",
      "impact_points": <int 1-15>,
      "priority": "required|optional"
    }
  ],
  "hr_perspective": {
    "verdict": "strong_yes|yes|maybe|no",
    "first_impression": "<max 220 chars>",
    "reasoning": "<2-3 sentences in HR voice>",
    "strengths": ["..."],
    "red_flags": ["..."]
  }
}
Rules:
- Compare wording sophistication AGAINST the candidate's apparent YOE. A 2-YOE engineer writing "architected enterprise ecosystems" is a HUGE red flag.
- Reward implementation-level language, concrete numbers (%, ms, MAUs, $$), tradeoff discussion, niche tooling, and even imperfect phrasing — these are human signals.
- Penalise generic leadership phrases, repeated abstract nouns (ecosystems/infrastructures/paradigms), keyword stuffing, and uniform sentence rhythm.
- For unverifiable_claims: only include claims with NO numbers, tools, or specifics.
- ats_score_after MUST be between 85 and 98. Generate up to 12 suggestions if needed.
- Suggestions MUST cover: (a) every high-severity AI-detected line, (b) injecting missing keywords naturally, (c) quantifying vague bullets, (d) tightening seniority wording to match YOE.
- DIMINISHING RETURNS GUARD: If ats_score_before >= 88, return AT MOST 2 "required" suggestions. Mark all others as "optional" with reason prefixed "Optional polish — ". Cap at 5 suggestions total.
- impact_points SUM must approximate (ats_score_after - ats_score_before).
- All dimension_scores values MUST be integers 0-100.`;
}
