/**
 * Converts icons/icon{16,48,128}.svg → icons/icon{16,48,128}.png
 * Also copies PNGs to public/icons/ so Vite includes them in dist/
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicIconsDir = join(root, 'public', 'icons');

if (!existsSync(publicIconsDir)) mkdirSync(publicIconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const svgPath = join(root, 'icons', `icon${size}.svg`);
  const pngPath = join(root, 'icons', `icon${size}.png`);
  const publicPngPath = join(publicIconsDir, `icon${size}.png`);

  const svg = readFileSync(svgPath);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)'
  });

  const pngData = resvg.render().asPng();
  writeFileSync(pngPath, pngData);
  copyFileSync(pngPath, publicPngPath);
  console.log(`✓ icon${size}.png → icons/ and public/icons/`);
}

console.log('Icons generated.');
