import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeResume } from '../lib/llm.js';

const MOCK_RESULT = {
  ats_score_before: 62,
  ats_score_after: 88,
  authenticity_score: 71,
  verdict_summary: 'Decent resume with inflated seniority signals.',
  dimension_scores: {
    buzzword_density: 55,
    specificity: 60,
    seniority_realism: 70,
    technical_depth: 65,
    semantic_redundancy: 40,
    style_entropy: 55,
    verifiability: 60,
    ats_manipulation: 30
  },
  ai_detected_lines: [],
  flagged_patterns: [],
  experience_realism: { stated_yoe: 3, implied_seniority: 'mid', mismatch_severity: 'none', evidence: [] },
  unverifiable_claims: [],
  ats_missing_keywords: ['TypeScript', 'Docker'],
  suggestions: [
    { original: 'Led projects', improved: 'Led 3 backend projects', reason: 'Add numbers', impact_points: 5, priority: 'required' }
  ],
  hr_perspective: { verdict: 'yes', first_impression: 'Solid mid-level candidate.', reasoning: '', strengths: [], red_flags: [] }
};

function mockFetchOk(body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body
  });
}

function mockFetchStatus(status) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: 'err' })
  });
}

const BASE_OPTS = {
  resumeText: 'Software engineer with 3 years experience.',
  jobDescription: 'Senior SWE role requiring TypeScript and Docker.'
};

describe('analyzeResume — provider wire formats', () => {
  it('anthropic: sends x-api-key header and anthropic body format', async () => {
    mockFetchOk({ content: [{ text: JSON.stringify(MOCK_RESULT) }] });
    await analyzeResume({ providerId: 'anthropic', apiKey: 'sk-ant-test', ...BASE_OPTS });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = opts.headers;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(opts.body);
    expect(body.system).toBeTruthy();
    expect(body.messages[0].role).toBe('user');
    expect(body.model).toBe('claude-sonnet-4-20250514');
  });

  it('openai: sends Authorization Bearer and messages array with system', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe('Bearer sk-test');
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.response_format.type).toBe('json_object');
  });

  it('gemini: appends key as URL param, no auth header, uses contents format', async () => {
    mockFetchOk({ candidates: [{ content: { parts: [{ text: JSON.stringify(MOCK_RESULT) }] } }] });
    await analyzeResume({ providerId: 'gemini', apiKey: 'AIza-test', ...BASE_OPTS });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('?key=AIza-test');
    expect(opts.headers['Authorization']).toBeUndefined();
    const body = JSON.parse(opts.body);
    expect(body.contents[0].role).toBe('user');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('groq: sends Bearer auth, openai format', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({ providerId: 'groq', apiKey: 'gsk_test', ...BASE_OPTS });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer gsk_test');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('llama-3.3-70b-versatile');
  });

  it('mistral: sends Bearer auth, openai format', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({ providerId: 'mistral', apiKey: 'mist-test', ...BASE_OPTS });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe('Bearer mist-test');
  });

  it('cohere: sends Bearer auth, cohere messages format', async () => {
    mockFetchOk({ message: { content: [{ text: JSON.stringify(MOCK_RESULT) }] } });
    await analyzeResume({ providerId: 'cohere', apiKey: 'co-test', ...BASE_OPTS });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.cohere.com/v2/chat');
    expect(opts.headers['Authorization']).toBe('Bearer co-test');
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
  });
});

describe('analyzeResume — custom provider', () => {
  it('uses custom endpoint, bearer auth, openai format, custom response path', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({
      providerId: 'custom',
      apiKey: 'custom-key',
      customConfig: {
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        authStyle: 'bearer',
        authHeaderName: '',
        model: 'anthropic/claude-3.5-sonnet',
        requestFormat: 'openai',
        responsePath: 'choices[0].message.content'
      },
      ...BASE_OPTS
    });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe('Bearer custom-key');
  });

  it('uses custom x-api-key auth style', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({
      providerId: 'custom',
      apiKey: 'my-key',
      customConfig: {
        endpoint: 'https://example.com/chat',
        authStyle: 'x-api-key',
        authHeaderName: '',
        model: 'gpt-4o',
        requestFormat: 'openai',
        responsePath: 'choices[0].message.content'
      },
      ...BASE_OPTS
    });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['x-api-key']).toBe('my-key');
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('uses custom auth header name', async () => {
    mockFetchOk({ content: [{ text: JSON.stringify(MOCK_RESULT) }] });
    await analyzeResume({
      providerId: 'custom',
      apiKey: 'my-key',
      customConfig: {
        endpoint: 'https://example.com/chat',
        authStyle: 'custom',
        authHeaderName: 'X-My-Custom-Auth',
        model: 'my-model',
        requestFormat: 'anthropic',
        responsePath: 'content[0].text'
      },
      ...BASE_OPTS
    });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['X-My-Custom-Auth']).toBe('my-key');
  });
});

describe('analyzeResume — response parsing', () => {
  it('returns parsed JSON result', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    const result = await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS });
    expect(result.ats_score_before).toBe(62);
    expect(result.ats_score_after).toBe(88);
    expect(result.suggestions).toHaveLength(1);
  });

  it('strips markdown fences around JSON', async () => {
    const fenced = '```json\n' + JSON.stringify(MOCK_RESULT) + '\n```';
    mockFetchOk({ choices: [{ message: { content: fenced } }] });
    const result = await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS });
    expect(result.ats_score_before).toBe(62);
  });

  it('throws EMPTY_RESPONSE when path resolves to falsy', async () => {
    mockFetchOk({ choices: [] });
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS })
    ).rejects.toThrow('EMPTY_RESPONSE');
  });

  it('throws MALFORMED_JSON when response is not valid JSON', async () => {
    mockFetchOk({ choices: [{ message: { content: 'not json at all' } }] });
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS })
    ).rejects.toThrow('MALFORMED_JSON');
  });
});

describe('analyzeResume — HTTP error handling', () => {
  it('throws INVALID_KEY on 401', async () => {
    mockFetchStatus(401);
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'bad', ...BASE_OPTS })
    ).rejects.toThrow('INVALID_KEY');
  });

  it('throws INVALID_KEY on 403', async () => {
    mockFetchStatus(403);
    await expect(
      analyzeResume({ providerId: 'anthropic', apiKey: 'bad', ...BASE_OPTS })
    ).rejects.toThrow('INVALID_KEY');
  });

  it('throws RATE_LIMITED on 429', async () => {
    mockFetchStatus(429);
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS })
    ).rejects.toThrow('RATE_LIMITED');
  });

  it('throws BAD_REQUEST on 400', async () => {
    mockFetchStatus(400);
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS })
    ).rejects.toThrow('BAD_REQUEST');
  });

  it('throws API_ERROR_500 on 500', async () => {
    mockFetchStatus(500);
    await expect(
      analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS })
    ).rejects.toThrow('API_ERROR_500');
  });
});

describe('analyzeResume — request body validation', () => {
  it('includes JD and resume text in user message', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({
      providerId: 'openai',
      apiKey: 'sk-test',
      resumeText: 'My resume content here',
      jobDescription: 'Job desc content here'
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    const userMsg = body.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('My resume content here');
    expect(userMsg).toContain('Job desc content here');
    expect(userMsg).toContain('JOB DESCRIPTION:');
    expect(userMsg).toContain('RESUME:');
  });

  it('system prompt instructs JSON-only output', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    const sysMsg = body.messages.find(m => m.role === 'system').content;
    expect(sysMsg).toContain('ONLY valid JSON');
    expect(sysMsg).toContain('ats_score_before');
    expect(sysMsg).toContain('suggestions');
    expect(sysMsg).toContain('hr_perspective');
  });

  it('passes AbortSignal through to fetch', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    const controller = new AbortController();
    await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', signal: controller.signal, ...BASE_OPTS });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.signal).toBe(controller.signal);
  });

  it('applies temperature and maxTokens from provider config', async () => {
    mockFetchOk({ choices: [{ message: { content: JSON.stringify(MOCK_RESULT) } }] });
    await analyzeResume({ providerId: 'openai', apiKey: 'sk-test', ...BASE_OPTS });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.35);
    expect(body.max_tokens).toBe(4096);
  });
});
