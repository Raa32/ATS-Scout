// PDF parsed entirely in-browser. No bytes transmitted to any server.
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');

/**
 * @param {File} file
 * @returns {Promise<{ text: string, lineBoxes: Array<Array<{text:string,x:number,y:number,width:number,height:number}>>, pageCanvasDataUrls: string[] }>}
 */
export async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  const allText = [];
  const lineBoxes = [];
  const pageCanvasDataUrls = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    pageCanvasDataUrls.push(canvas.toDataURL('image/png'));

    const textContent = await page.getTextContent();
    const items = textContent.items;

    const lines = groupItemsIntoLines(items, viewport);
    lineBoxes.push(lines);

    const pageText = lines.map(l => l.text).join('\n');
    allText.push(pageText);
  }

  return {
    text: allText.join('\n\n'),
    lineBoxes,
    pageCanvasDataUrls
  };
}

function groupItemsIntoLines(items, viewport) {
  if (!items || items.length === 0) return [];

  const scale = viewport.scale;
  const mappedItems = items
    .filter(item => item.str && item.str.trim())
    .map(item => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = tx[4];
      const y = tx[5];
      const width = item.width * scale;
      const height = item.height * scale;
      return { str: item.str, x, y, width, height };
    });

  mappedItems.sort((a, b) => b.y - a.y || a.x - b.x);

  const lineGroups = [];
  const Y_TOLERANCE = 3;

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
