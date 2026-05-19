import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF before importing exportPdf
const mockDoc = {
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  rect: vi.fn(),
  line: vi.fn(),
  text: vi.fn(),
  addPage: vi.fn(),
  splitTextToSize: vi.fn((text) => [text]),
  save: vi.fn()
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function () { return mockDoc; })
}));

import { exportReport } from '../lib/exportPdf.js';

const FULL_RESULT = {
  ats_score_before: 65,
  ats_score_after: 88,
  authenticity_score: 72,
  verdict_summary: 'Resume shows signs of AI inflation.',
  dimension_scores: {
    buzzword_density: 60,
    specificity: 55,
    seniority_realism: 65,
    technical_depth: 70,
    semantic_redundancy: 45,
    style_entropy: 50,
    verifiability: 60,
    ats_manipulation: 35
  },
  hr_perspective: {
    verdict: 'yes',
    first_impression: 'Solid profile with some red flags.',
    reasoning: 'Candidate shows promise but inflated claims.',
    strengths: ['Strong technical skills', 'Good project diversity'],
    red_flags: ['Vague impact metrics', 'Overused buzzwords']
  },
  ats_missing_keywords: ['TypeScript', 'Kubernetes', 'CI/CD'],
  suggestions: [
    { original: 'Led projects', improved: 'Led 3 projects shipping to 50k MAUs', reason: 'Add numbers', impact_points: 8, priority: 'required' },
    { original: 'Worked on APIs', improved: 'Built REST APIs handling 10k req/s', reason: 'Quantify', impact_points: 5, priority: 'optional' }
  ]
};

describe('exportReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls doc.save with a filename containing the resume filename and date', () => {
    exportReport({ result: FULL_RESULT, fileName: 'my_resume.pdf', providerName: 'Claude (Anthropic)' });
    expect(mockDoc.save).toHaveBeenCalledOnce();
    const savedName = mockDoc.save.mock.calls[0][0];
    expect(savedName).toMatch(/^ats-scout-report-my_resume_pdf-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('calls jsPDF constructor with A4 format', async () => {
    const { jsPDF } = await import('jspdf');
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    expect(jsPDF).toHaveBeenCalledWith({ unit: 'mm', format: 'a4' });
  });

  it('writes title text "ATS Scout Analysis Report"', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allTextCalls = mockDoc.text.mock.calls.map(c => c[0]);
    expect(allTextCalls).toContain('ATS Scout Analysis Report');
  });

  it('writes ATS score section', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('65');
    expect(allText).toContain('88');
  });

  it('writes provider name in metadata line', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'Google Gemini' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('Google Gemini');
  });

  it('writes HR verdict', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('YES');
  });

  it('writes missing keywords', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('TypeScript');
    expect(allText).toContain('Kubernetes');
  });

  it('writes required and optional suggestions', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('Required Rewrites');
    expect(allText).toContain('Optional Polish');
    expect(allText).toContain('Led projects');
    expect(allText).toContain('Worked on APIs');
  });

  it('writes footer with zero servers claim', () => {
    exportReport({ result: FULL_RESULT, fileName: 'test.pdf', providerName: 'OpenAI' });
    const allText = mockDoc.text.mock.calls.map(c => String(c[0])).join(' ');
    expect(allText).toContain('zero servers');
  });

  it('sanitizes special characters in filename (no spaces or dots in saved name)', () => {
    exportReport({ result: FULL_RESULT, fileName: 'My Resume v2.0.pdf', providerName: 'OpenAI' });
    const savedName = mockDoc.save.mock.calls[0][0];
    expect(savedName).not.toContain(' ');
    expect(savedName).toMatch(/^ats-scout-report-/);
  });

  it('handles missing optional fields gracefully (no strengths, no suggestions)', () => {
    const minimal = {
      ...FULL_RESULT,
      hr_perspective: { ...FULL_RESULT.hr_perspective, strengths: undefined, red_flags: undefined },
      suggestions: [],
      ats_missing_keywords: []
    };
    expect(() => exportReport({ result: minimal, fileName: 'min.pdf', providerName: 'Groq' })).not.toThrow();
  });

  it('handles undefined dimension_scores gracefully', () => {
    const noDims = { ...FULL_RESULT, dimension_scores: undefined };
    expect(() => exportReport({ result: noDims, fileName: 'test.pdf', providerName: 'OpenAI' })).not.toThrow();
  });
});
