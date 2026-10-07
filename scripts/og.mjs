// Genera web/og.png (1200×630), la imagen que se ve al compartir el enlace.
//   node scripts/og.mjs
// Requiere: npm i --no-save playwright-core  ·  Google Chrome instalado
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const fonts = pathToFileURL(join(root, 'web', 'fonts', 'fonts.css')).href;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="${fonts}">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #000; color: #f2f2f2; font-family: 'Inter', sans-serif; position: relative; }
  .mono { font: 500 20px/1 'JetBrains Mono', monospace; letter-spacing: 0.32em; text-transform: uppercase; }
  .mut { color: #8a8a8a; }
  svg { position: absolute; right: -40px; top: 15px; width: 640px; height: 600px; }
  .top { position: absolute; left: 64px; top: 56px; display: flex; align-items: center; gap: 18px; font-weight: 700; }
  .top i { width: 34px; height: 34px; background: url("${pathToFileURL(join(root, 'web', 'favicon.svg')).href}") center / contain no-repeat; }
  h1 { position: absolute; left: 52px; top: 150px; font-size: 300px; line-height: 0.8; font-weight: 900; letter-spacing: -0.075em; }
  .sub { position: absolute; left: 64px; top: 430px; font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
  .foot { position: absolute; left: 64px; right: 64px; bottom: 52px; display: flex; justify-content: space-between; align-items: baseline; padding-top: 22px; border-top: 1px solid rgba(255, 255, 255, 0.22); }
  .foot b { color: #f2f2f2; font-weight: 700; }
</style></head>
<body>
  <svg viewBox="0 0 640 600" fill="none" stroke="#f2f2f2" stroke-dasharray="2 7" stroke-linecap="round">
    <g transform="translate(320 300)" opacity="0.55">
      <ellipse rx="150" ry="70" stroke-width="16" transform="rotate(-35)"/>
      <ellipse rx="215" ry="105" stroke-width="16" transform="rotate(58)"/>
      <ellipse rx="285" ry="150" stroke-width="16" transform="rotate(12)"/>
    </g>
    <circle cx="320" cy="300" r="26" fill="#f2f2f2" stroke="none" opacity="0.8"/>
  </svg>
  <div class="top mono"><i></i>MIDI Track Split</div>
  <h1>SPLIT</h1>
  <p class="sub">Separa un MIDI en pistas, escúchalo y descárgalas.</p>
  <div class="foot mono mut"><span>Por <b>Daniel Martínez Sebastián</b></span><span>martinezsebastian.com</span></div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const file = join(root, 'docs', '_og.html');
await (await import('node:fs/promises')).writeFile(file, html);
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.fonts.status === 'loaded');
await page.screenshot({ path: join(root, 'web', 'og.png') });
await browser.close();
await (await import('node:fs/promises')).rm(file);
console.log('  web/og.png');
