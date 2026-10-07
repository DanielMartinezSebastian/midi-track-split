// Genera la imagen que se ve al compartir el enlace, una por idioma (web/og.png, web/en/og.png,
// web/de/og.png; 1200×630): el fondo 3D real de la
// app (cargada con ?bare, solo el lienzo) con el título y la autoría encima.
//   node scripts/og.mjs
// Requiere: npm i --no-save playwright-core  ·  Google Chrome instalado
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { PAGES } from './pages/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4320;

const overlay = (p) => `
  <style>
    /* el lienzo, desplazado a la derecha y ampliado: deja el texto a la izquierda, como en la app */
    .mts__bg { transform: translateX(250px) scale(1.55); opacity: 0.8; }
    #og, #og * { box-sizing: border-box; margin: 0; }
    #og { position: fixed; inset: 0; z-index: 99; color: #f2f2f2; font-family: 'Inter', sans-serif;
      background: linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.92) 17%, transparent 34%), linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%); }
    #og .mono { font: 500 20px/1 'JetBrains Mono', monospace; letter-spacing: 0.32em; text-transform: uppercase; }
    #og .top { position: absolute; left: 64px; top: 56px; display: flex; align-items: center; gap: 18px; font-weight: 700; }
    #og .top i { width: 34px; height: 34px; background: url("/favicon.svg") center / contain no-repeat; }
    #og h1 { position: absolute; left: 52px; top: 150px; font-size: 300px; line-height: 0.8; font-weight: 900; letter-spacing: -0.075em; }
    #og .sub { position: absolute; left: 64px; top: 430px; font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
    #og .foot { position: absolute; left: 64px; right: 64px; bottom: 52px; display: flex; justify-content: space-between; align-items: baseline; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.3); color: #a8a8a8; }
    #og .foot b { color: #f2f2f2; font-weight: 700; }
  </style>
  <div id="og">
    <div class="top mono"><i></i>MIDI Track Split</div>
    <h1>SPLIT</h1>
    <p class="sub">${p.og.sub}</p>
    <div class="foot mono"><span>${p.og.by} <b>Daniel Martínez Sebastián</b></span><span>martinezsebastian.com</span></div>
  </div>`;

const srv = spawn(process.execPath, ['server.js'], {
  cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await wait(1200);

// Chrome del sistema, con WebGL por software para el lienzo 3D
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}${p.path}?bare`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mts__bg canvas');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), overlay(p));
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await wait(Number(process.argv[2]) || 6000); // los anillos giran: este instante da una buena pose
  await page.screenshot({ path: join(root, 'web', p.path, 'og.png') });
  await page.close();
  console.log(`  web${p.path}og.png`);
}
await browser.close();
srv.kill();
