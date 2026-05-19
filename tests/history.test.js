import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveAnalysis, getHistory, clearHistory, timeAgo } from '../lib/history.js';

const MOCK_RESULT = { ats_score_before: 60, ats_score_after: 85 };

const ENTRY_BASE = {
  fileName: 'resume.pdf',
  resumeText: 'Software engineer...',
  jobDescription: 'Senior SWE...',
  providerId: 'openai',
  providerName: 'OpenAI (GPT-4o mini)',
  result: MOCK_RESULT
};

describe('getHistory', () => {
  it('returns empty array when nothing saved', async () => {
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});

describe('saveAnalysis', () => {
  it('saves an entry and returns it with id + createdAt', async () => {
    const entry = await saveAnalysis(ENTRY_BASE);
    expect(entry.id).toBeTruthy();
    expect(entry.fileName).toBe('resume.pdf');
    expect(entry.providerId).toBe('openai');
    expect(entry.result).toEqual(MOCK_RESULT);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('entry appears in getHistory', async () => {
    await saveAnalysis(ENTRY_BASE);
    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].fileName).toBe('resume.pdf');
  });

  it('newer entries appear first (newest-first order)', async () => {
    await saveAnalysis({ ...ENTRY_BASE, fileName: 'first.pdf' });
    await saveAnalysis({ ...ENTRY_BASE, fileName: 'second.pdf' });
    const history = await getHistory();
    expect(history[0].fileName).toBe('second.pdf');
    expect(history[1].fileName).toBe('first.pdf');
  });

  it('stores providerName for display', async () => {
    await saveAnalysis({ ...ENTRY_BASE, providerName: 'Claude (Anthropic)' });
    const [entry] = await getHistory();
    expect(entry.providerName).toBe('Claude (Anthropic)');
  });

  it('caps history at 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await saveAnalysis({ ...ENTRY_BASE, fileName: `resume${i}.pdf` });
    }
    const history = await getHistory();
    expect(history).toHaveLength(20);
  });

  it('keeps most recent 20 when over limit', async () => {
    for (let i = 0; i < 22; i++) {
      await saveAnalysis({ ...ENTRY_BASE, fileName: `resume${i}.pdf` });
    }
    const history = await getHistory();
    expect(history[0].fileName).toBe('resume21.pdf');
    expect(history[19].fileName).toBe('resume2.pdf');
  });

  it('each entry has a unique id', async () => {
    await saveAnalysis(ENTRY_BASE);
    await saveAnalysis(ENTRY_BASE);
    const history = await getHistory();
    const ids = history.map(e => e.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('clearHistory', () => {
  it('clears all entries', async () => {
    await saveAnalysis(ENTRY_BASE);
    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});

describe('timeAgo', () => {
  it('returns "just now" for < 1 minute', () => {
    expect(timeAgo(Date.now() - 30_000)).toBe('just now');
    expect(timeAgo(Date.now() - 59_000)).toBe('just now');
  });

  it('returns "Xm ago" for < 1 hour', () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(timeAgo(Date.now() - 59 * 60_000)).toBe('59m ago');
  });

  it('returns "Xh ago" for < 24 hours', () => {
    expect(timeAgo(Date.now() - 2 * 3_600_000)).toBe('2h ago');
    expect(timeAgo(Date.now() - 23 * 3_600_000)).toBe('23h ago');
  });

  it('returns "Xd ago" for >= 24 hours', () => {
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe('2d ago');
    expect(timeAgo(Date.now() - 7 * 86_400_000)).toBe('7d ago');
  });
});
