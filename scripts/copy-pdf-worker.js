/**
 * Copies pdfjs-dist worker into public/lib/ so Chrome can load it via
 * chrome.runtime.getURL('lib/pdf.worker.min.mjs')
 * Run once after npm install, or as part of prebuild.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const destDir = join(root, 'public', 'lib');
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
const workerSrc = join(pdfjsDir, 'build', 'pdf.worker.min.mjs');
const workerDest = join(destDir, 'pdf.worker.min.mjs');

copyFileSync(workerSrc, workerDest);
console.log(`✓ Copied pdf.worker.min.mjs → public/lib/`);
