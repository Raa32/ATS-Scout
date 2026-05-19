import { describe, it, expect, vi } from 'vitest';

// pdfUtils depends on pdfjs-dist and chrome.runtime.getURL.
// We test the internal line-grouping logic by extracting it — and mock pdfjsLib.
vi.mock('pdfjs-dist', () => ({
  default: {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
    Util: {
      transform: vi.fn((transform, itemTransform) => {
        // Identity transform: return item transform values
        return itemTransform;
      })
    }
  },
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  Util: {
    transform: vi.fn((transform, itemTransform) => itemTransform)
  }
}));

// Inline the pure grouping logic so we can unit-test it without PDF parsing
function groupItemsIntoLines(items) {
  if (!items || items.length === 0) return [];

  const Y_TOLERANCE = 3;
  const mappedItems = items.filter(item => item.str && item.str.trim());

  mappedItems.sort((a, b) => b.y - a.y || a.x - b.x);

  const lineGroups = [];
  for (const item of mappedItems) {
    const existing = lineGroups.find(g => Math.abs(g.baseY - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
      existing.baseY = (existing.baseY + item.y) / 2;
    } else {
      lineGroups.push({ baseY: item.y, items: [item] });
    }
  }

  return lineGroups.map(group => {
    group.items.sort((a, b) => a.x - b.x);
    const text = group.items.map(i => i.str).join(' ').trim();
    const xs = group.items.map(i => i.x);
    const ys = group.items.map(i => i.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const rightEdges = group.items.map(i => i.x + i.width);
    const width = Math.max(...rightEdges) - x;
    const heights = group.items.map(i => i.height);
    const height = Math.max(...heights);
    return { text, x, y, width, height };
  }).filter(l => l.text.length > 0);
}

// Tokenizer mirroring sidepanel.js / pdfUtils fuzzy match
function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
}

function fuzzyMatch(targetText, pageLines) {
  const targetTokens = tokenize(targetText);
  if (!targetTokens.length || !pageLines?.length) return null;
  let best = null, bestScore = 0.74;
  for (const line of pageLines) {
    const lt = tokenize(line.text);
    const overlap = targetTokens.filter(t => lt.includes(t)).length;
    const score = overlap / Math.max(targetTokens.length, lt.length);
    if (score > bestScore) { bestScore = score; best = line; }
  }
  return best;
}

describe('groupItemsIntoLines', () => {
  it('returns empty array for empty input', () => {
    expect(groupItemsIntoLines([])).toEqual([]);
    expect(groupItemsIntoLines(null)).toEqual([]);
  });

  it('groups items on same Y into one line', () => {
    const items = [
      { str: 'Hello', x: 10, y: 100, width: 40, height: 12 },
      { str: 'World', x: 55, y: 100, width: 40, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello World');
  });

  it('separates items on different Y values into separate lines', () => {
    const items = [
      { str: 'Line One', x: 10, y: 200, width: 60, height: 12 },
      { str: 'Line Two', x: 10, y: 150, width: 60, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });

  it('groups items within Y_TOLERANCE (3px) together', () => {
    const items = [
      { str: 'Part', x: 10, y: 100, width: 30, height: 12 },
      { str: 'Same', x: 50, y: 102, width: 40, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain('Part');
    expect(lines[0].text).toContain('Same');
  });

  it('separates items beyond Y_TOLERANCE (>3px apart)', () => {
    const items = [
      { str: 'Top', x: 10, y: 100, width: 30, height: 12 },
      { str: 'Bottom', x: 10, y: 104, width: 40, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });

  it('sorts items left-to-right within a line', () => {
    const items = [
      { str: 'Second', x: 80, y: 100, width: 50, height: 12 },
      { str: 'First', x: 10, y: 100, width: 50, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines[0].text).toBe('First Second');
  });

  it('filters out whitespace-only items', () => {
    const items = [
      { str: '   ', x: 10, y: 100, width: 10, height: 12 },
      { str: 'Real', x: 20, y: 100, width: 30, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines[0].text).toBe('Real');
  });

  it('computes correct bounding box (x, y, width, height)', () => {
    const items = [
      { str: 'A', x: 10, y: 100, width: 20, height: 12 },
      { str: 'B', x: 40, y: 100, width: 25, height: 14 }
    ];
    const [line] = groupItemsIntoLines(items);
    expect(line.x).toBe(10);
    expect(line.y).toBe(100);
    expect(line.width).toBe(55);    // rightEdge(B)=65, leftEdge=10
    expect(line.height).toBe(14);   // max height
  });

  it('handles single item', () => {
    const items = [{ str: 'Solo', x: 5, y: 50, width: 30, height: 10 }];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Solo');
  });

  it('handles multi-line PDF correctly', () => {
    const items = [
      { str: 'Name:', x: 10, y: 300, width: 40, height: 12 },
      { str: 'John', x: 55, y: 300, width: 35, height: 12 },
      { str: 'Experience:', x: 10, y: 250, width: 80, height: 12 },
      { str: '3 years', x: 95, y: 250, width: 55, height: 12 },
      { str: 'Skills:', x: 10, y: 200, width: 50, height: 12 }
    ];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(3);
    const texts = lines.map(l => l.text);
    expect(texts).toContain('Name: John');
    expect(texts).toContain('Experience: 3 years');
    expect(texts).toContain('Skills:');
  });
});

describe('fuzzyMatch', () => {
  const pageLines = [
    { text: 'Architected enterprise-grade microservices infrastructure', x: 10, y: 300, width: 400, height: 14 },
    { text: 'Led a team of 5 engineers to deliver the product', x: 10, y: 280, width: 350, height: 14 },
    { text: 'Improved system performance by 40%', x: 10, y: 260, width: 300, height: 14 },
    { text: 'Managed cross-functional stakeholder relationships', x: 10, y: 240, width: 380, height: 14 }
  ];

  it('matches exact line text', () => {
    const match = fuzzyMatch('Improved system performance by 40%', pageLines);
    expect(match).not.toBeNull();
    expect(match.text).toContain('Improved system performance');
  });

  it('matches partial/truncated line text with high token overlap', () => {
    // "Architected microservices infrastructure" shares 3/4 tokens with the
    // page line "Architected enterprise-grade microservices infrastructure"
    // score = 3/max(3,4) = 0.75 > 0.74 threshold
    const match = fuzzyMatch('Architected microservices infrastructure', pageLines);
    expect(match).not.toBeNull();
    expect(match.text).toContain('Architected');
  });

  it('returns null for very different text (below threshold)', () => {
    const match = fuzzyMatch('Unrelated text about cooking recipes', pageLines);
    expect(match).toBeNull();
  });

  it('returns null for empty target text', () => {
    expect(fuzzyMatch('', pageLines)).toBeNull();
    expect(fuzzyMatch(null, pageLines)).toBeNull();
  });

  it('returns null for empty page lines', () => {
    expect(fuzzyMatch('Some text', [])).toBeNull();
    expect(fuzzyMatch('Some text', null)).toBeNull();
  });

  it('tokenize ignores short words (<= 2 chars)', () => {
    const tokens = tokenize('I am a senior engineer');
    expect(tokens).not.toContain('i');
    expect(tokens).not.toContain('am');
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('senior');
    expect(tokens).toContain('engineer');
  });

  it('tokenize lowercases and strips punctuation', () => {
    const tokens = tokenize('TypeScript, React.js, Node.js!');
    expect(tokens).toContain('typescript');
    expect(tokens).toContain('reactjs');
  });
});
