// Genera las capturas de docs/shots/ y el GIF de demo (docs/demo.gif).
//   node scripts/capture.mjs
// Requiere: npm i --no-save playwright-core  ·  Google Chrome instalado  ·  ffmpeg en el PATH (para el GIF)
// y las muestras descargadas (npm run fetch-sounds) para que la reproducción no dependa del CDN.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'docs', 'shots');
const FRAMES = join(root, 'docs', 'frames');
const GIF = join(root, 'docs', 'demo.gif');
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

// Chrome del sistema, con WebGL por software (el fondo es un lienzo 3D) y audio sin gesto previo
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

async function open(viewport, deviceScaleFactor, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, colorScheme: 'dark', ...extra });
  await ctx.grantPermissions(['midi']);
  await ctx.addInitScript(NO_SMOOTH);
  await ctx.addInitScript(MIDI_MOCK);
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForSelector('.mts__bg canvas');
  await wait(1500); // el lienzo necesita unos fotogramas para arrancar
  return { ctx, page };
}

// acciones sobre la interfaz
const load = async (page) => {
  await page.setInputFiles('input[type=file]', DEMO);
  await page.waitForSelector('.mts__track');
  await wait(600);
};
const scrollTo = (page, sel, top = 0) =>
  page.$eval(sel, (el, t) => window.scrollBy(0, el.getBoundingClientRect().top - t), top);
// botones de la pista n (1…): 1 Solo · 2 Mute · 3 EXT · 4 ▶ · 5 .mid
const trackBtn = (page, n, b) => page.locator(`.mts__track:nth-child(${n}) .mts__ctrl button`).nth(b - 1);
const dockBtn = (page, name) => page.locator('.mts-dock').getByRole('button', { name, exact: true });
// pulsa reproducir y espera a que suene de verdad (la primera vez hay que cargar las muestras)
const play = async (page) => {
  await page.click('.mts-dock__play');
  await page.waitForSelector('.mts--playing', { timeout: 60000 });
};
const connectMidi = async (page) => {
  await page.getByRole('button', { name: 'Conectar teclado MIDI' }).click();
  await page.locator('#teclado .ui-select__trigger').first().click();
  await page.getByRole('option', { name: /JT MINI/ }).click();
  await wait(300);
};

// ============ 1 · capturas (retina) ============
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, 2);
  let s = 0;
  const shot = async (name) => {
    s++;
    const file = `${String(s).padStart(2, '0')}-${name}.png`;
    await wait(250);
    await page.screenshot({ path: join(SHOTS, file) });
    console.log('  docs/shots/' + file);
  };

  await shot('landing');

  await load(page);
  await shot('loaded');

  await scrollTo(page, '#pistas');
  await shot('tracks');

  await dockBtn(page, 'Repetir en bucle').click();
  await play(page);
  await wait(9000); // con las cuatro pistas ya sonando
  await shot('playing');

  await trackBtn(page, 1, 1).click(); // solo en la primera pista
  await wait(1500);
  await shot('solo');
  await trackBtn(page, 1, 1).click();

  await scrollTo(page, '#teclado');
  await connectMidi(page);
  await shot('midi');

  await scrollTo(page, '#pistas');
  await trackBtn(page, 3, 3).click(); // la tercera pista, al teclado
  await wait(1200);
  await shot('ext');
  await trackBtn(page, 3, 3).click();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.mts__full'); // solo las visuales
  await wait(5000);
  await shot('visuals');
  await page.click('.mts__bg'); // otro estilo de render
  await wait(2500);
  await shot('visuals-braille');

  await ctx.close();
}

// ============ 2 · captura en móvil ============
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3, { hasTouch: true, isMobile: true });
  await page.screenshot({ path: join(SHOTS, '10-mobile-landing.png') });
  await load(page);
  await scrollTo(page, '#pistas');
  await play(page);
  await wait(9000);
  await page.screenshot({ path: join(SHOTS, '11-mobile-tracks.png') });
  console.log('  docs/shots/10-mobile-landing.png\n  docs/shots/11-mobile-tracks.png');
  await ctx.close();
}

// ============ 3 · fotogramas para el GIF ============
{
  const { ctx, page } = await open({ width: 1100, height: 700 }, 1);
  let f = 0;
  const frame = async (hold = 1) => {
    for (let i = 0; i < hold; i++) {
      f++;
      await page.screenshot({ path: join(FRAMES, `${String(f).padStart(3, '0')}.png`) });
    }
    process.stdout.write(`\r  ${f} fotogramas`);
  };
  const roll = async (n, ms = 260) => {
    for (let i = 0; i < n; i++) { await wait(ms); await frame(); }
  };

  await frame(4); // portada

  await load(page);
  await frame(4); // archivo cargado: su nombre como título

  await scrollTo(page, '#pistas');
  await frame(2);

  // reproducir: las pistas con nota en curso se encienden y el fondo dibuja su onda
  await dockBtn(page, 'Repetir en bucle').click();
  await play(page);
  await roll(16);

  // solo en una pista
  await trackBtn(page, 1, 1).click();
  await roll(7);
  await trackBtn(page, 1, 1).click();

  // silenciar otra
  await trackBtn(page, 2, 2).click();
  await roll(7);
  await trackBtn(page, 2, 2).click();
  await roll(3);

  // pantalla completa: solo las visuales; un toque en el lienzo cambia el estilo
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.mts__full');
  await roll(12);
  await page.click('.mts__bg');
  await roll(9);
  await page.click('.mts__bg');
  await roll(9);

  await ctx.close();
}

await browser.close();
srv.kill();
console.log('\n');

// ============ 4 · GIF ============
const ff = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', '5', '-i', join(FRAMES, '%03d.png'),
  '-vf', 'scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=16:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  GIF,
], { stdio: 'inherit' });
console.log(ff.status === 0
  ? 'capturas: docs/shots/   GIF: docs/demo.gif'
  : 'capturas: docs/shots/   fotogramas: docs/frames/   (sin ffmpeg no se ha generado el GIF)');
