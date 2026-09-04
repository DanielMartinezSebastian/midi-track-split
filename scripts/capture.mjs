// Genera capturas para el README y los fotogramas del GIF de demo.
//   node scripts/capture.mjs
// Requiere: npm i -D playwright  ·  muestras descargadas (npm run fetch-sounds)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'docs', 'shots');
const FRAMES = join(root, 'docs', 'frames');
const DEMO = join(root, 'sample', 'demo.mid');
const PORT = 4319;
const APP_URL = `http://localhost:${PORT}/`;

const NO_SMOOTH = `
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{scroll-behavior:auto !important}';
  (document.head || document.documentElement).appendChild(st);
`;
const MIDI_MOCK = `
  const out = {
    id: 'jt-mini', name: 'JT MINI', manufacturer: 'BEHRINGER International GmbH',
    state: 'connected', type: 'output', connection: 'open',
    send() {}, clear() {}, open: async () => {}, close: async () => {},
    addEventListener() {}, removeEventListener() {},
  };
  navigator.requestMIDIAccess = async () => ({
    inputs: new Map(), outputs: new Map([[out.id, out]]),
    onstatechange: null, sysexEnabled: false,
    addEventListener() {}, removeEventListener() {},
  });
`;

const srv = spawn(process.execPath, ['server.js'], {
  cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await wait(1200);
for (const d of [SHOTS, FRAMES]) {
  await rm(d, { recursive: true, force: true });
  await mkdir(d, { recursive: true });
}

const browser = await chromium.launch();

// deja el elemento `sel` con su borde superior a `top` px del viewport
const anchor = (page, sel, top = 24) =>
  page.$eval(sel, (el, t) => {
    window.scrollBy(0, el.getBoundingClientRect().top - t);
  }, top);

// clip ajustado al elemento `sel` con un margen `pad`
async function clipFor(page, sel, pad = 24, vw = 1100) {
  await anchor(page, sel, pad);
  const b = await page.locator(sel).boundingBox();
  return {
    x: Math.max(0, Math.round(b.x - pad)),
    y: Math.max(0, Math.round(b.y - pad)),
    width: Math.min(vw, Math.round(b.width + pad * 2)),
    height: Math.round(b.height + pad * 2),
  };
}

// ============ 1 · capturas para el README (retina) ============
{
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light',
  });
  await ctx.grantPermissions(['midi']);
  await ctx.addInitScript(NO_SMOOTH);
  await ctx.addInitScript(MIDI_MOCK);
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await wait(300);

  let s = 0;
  const shot = async (name, sel) => {
    s++;
    const p = { path: join(SHOTS, `${String(s).padStart(2, '0')}-${name}.png`) };
    if (sel === 'full') { p.fullPage = true; await page.evaluate(() => window.scrollTo(0, 0)); }
    else if (sel) p.clip = await clipFor(page, sel);
    else await page.evaluate(() => window.scrollTo(0, 0));
    await wait(120);
    await page.screenshot(p);
    console.log('  docs/shots/' + p.path.split(/[\\/]/).pop());
  };

  await shot('landing');

  await page.setInputFiles('#file', DEMO);
  await page.waitForSelector('#track-list li');
  await wait(400);

  await page.click('#midi-connect');
  await page.waitForSelector('#midi-controls:not([hidden])');
  await page.selectOption('#midi-device', 'jt-mini');
  await wait(250);
  await shot('app', 'full');
  await shot('player', '#player');
  await shot('tracks', '#tracks');

  await page.click('#track-list li:last-child .locate');
  await wait(1500);
  await shot('playing', '#tracks');

  await page.click('#track-list li:nth-child(3) .ext-btn'); // pista al teclado
  await wait(600);
  await shot('ext', '#tracks');

  await page.click('#track-list li:first-child .solo-btn'); // solo en el PC
  await wait(600);
  await shot('solo', '#tracks');
  await page.click('#track-list li:first-child .solo-btn');
  await page.click('#track-list li:nth-child(3) .ext-btn');
  await page.click('#stop');
  await wait(200);

  const ni = page.locator('#track-list li:first-child .tname-input');
  await ni.click();
  await ni.fill('Piano principal');
  await page.keyboard.press('Tab');
  await wait(200);
  await shot('rename', '#tracks');

  await ctx.close();
}

// ============ 2 · fotogramas para el GIF (página completa visible) ============
{
  // viewport que abarca toda la app (cabecera + reproductor + pistas) sin scroll
  const ctx = await browser.newContext({
    viewport: { width: 1040, height: 1520 }, deviceScaleFactor: 1, colorScheme: 'light',
  });
  await ctx.grantPermissions(['midi']);
  await ctx.addInitScript(NO_SMOOTH);
  await ctx.addInitScript(MIDI_MOCK);
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await wait(300);

  let f = 0;
  const frame = async (hold = 1) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < hold; i++) {
      f++;
      await page.screenshot({ path: join(FRAMES, `${String(f).padStart(3, '0')}.png`) });
    }
    process.stdout.write(`\r  ${f} fotogramas`);
  };

  await frame(3); // portada

  // conectar MIDI ya (para que el panel salga en todo el GIF)
  await page.setInputFiles('#file', DEMO);
  await page.waitForSelector('#track-list li');
  await wait(400);
  await page.click('#midi-connect');
  await page.waitForSelector('#midi-controls:not([hidden])');
  await page.selectOption('#midi-device', 'jt-mini');
  await wait(300);
  await frame(4); // app cargada con salida MIDI

  // reproducir: se iluminan las pistas (verde = PC)
  await page.click('#track-list li:last-child .locate');
  for (let i = 0; i < 8; i++) { await wait(430); await frame(1); }

  // EXT: mandar una pista al teclado (se pone lila, el resto sigue en verde)
  await page.click('#track-list li:nth-child(3) .ext-btn');
  for (let i = 0; i < 7; i++) { await wait(430); await frame(1); }

  // solo en una pista de PC (no afecta a la que va al teclado)
  await page.click('#track-list li:first-child .solo-btn');
  for (let i = 0; i < 5; i++) { await wait(430); await frame(1); }
  await page.click('#track-list li:first-child .solo-btn');
  await page.click('#track-list li:nth-child(3) .ext-btn'); // quitar EXT
  await page.click('#stop');
  await wait(200);
  await frame(2);

  // renombrar una pista
  const ni = page.locator('#track-list li:first-child .tname-input');
  await ni.click();
  await ni.fill('');
  for (const ch of 'Piano principal') {
    await ni.press(ch === ' ' ? 'Space' : ch);
    await frame(1);
  }
  await page.keyboard.press('Tab');
  await frame(5);

  await ctx.close();
}

await browser.close();
srv.kill();
console.log('\n\ncapturas: docs/shots/   fotogramas: docs/frames/');
