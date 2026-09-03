// Descarga las fuentes (subconjunto latino) de Google Fonts a web/fonts/
// y genera web/fonts/fonts.css con @font-face locales.
//   node scripts/fetch-fonts.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'web', 'fonts');

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Syne:wght@700;800&display=swap';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then((r) => r.text());

await mkdir(dir, { recursive: true });

const faces = [];
const seen = new Set();
for (const block of css.split('@font-face').slice(1)) {
  const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
  if (!range.includes('U+0000-00FF')) continue; // solo subconjunto latino
  const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
  const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
  const url = (block.match(/url\(([^)]+)\)\s*format\('woff2'\)/) || [])[1];
  if (!family || !weight || !url) continue;
  const key = `${family}-${weight}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const file = `${family.replace(/\s+/g, '')}-${weight}.woff2`.toLowerCase();
  const buf = new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()));
  await writeFile(join(dir, file), buf);
  console.log(`  web/fonts/${file}  ${(buf.length / 1024).toFixed(1)} KB`);
  faces.push({ family, weight, file });
}

const out =
  '/* Generado por scripts/fetch-fonts.mjs — fuentes locales, sin CDN */\n' +
  faces
    .map(
      (f) =>
        `@font-face {\n  font-family: '${f.family}';\n  font-style: normal;\n` +
        `  font-weight: ${f.weight};\n  font-display: swap;\n` +
        `  src: url('${f.file}') format('woff2');\n}\n`
    )
    .join('\n');
await writeFile(join(dir, 'fonts.css'), out);
console.log(`\n  web/fonts/fonts.css  (${faces.length} @font-face)`);
