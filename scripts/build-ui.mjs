// Empaqueta la interfaz (ui/, React + trama-ui) en web/app.js y web/app.css, más los trozos de
// web/chunks/ (el fondo 3D y lo que comparte con la app), que se cargan bajo demanda.
// Las librerías de web/vendor/ quedan fuera: las resuelve el import map de index.html.
//   node scripts/build-ui.mjs           -> build minificado
//   node scripts/build-ui.mjs --watch   -> recompila al guardar (sin minificar)
import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { app: join(root, 'ui', 'main.jsx') },
  outdir: join(root, 'web'),
  bundle: true,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  // las librerías de web/vendor/ (import map) y los recursos que el CSS pide por URL quedan fuera
  external: ['tone', '@tonejs/midi', 'smplr', 'jszip', 'midi-file', 'favicon.svg'],
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'warning',
};

// los trozos llevan hash en el nombre: se borran los de la compilación anterior
rmSync(join(root, 'web', 'chunks'), { recursive: true, force: true });

if (watch) {
  const ctx = await context({ ...options, logLevel: 'info' });
  await ctx.watch();
} else {
  await build(options);
  for (const f of ['app.js', 'app.css']) {
    const kb = (statSync(join(root, 'web', f)).size / 1024).toFixed(0);
    console.log(`  web/${f}  ${kb} KB`);
  }
  for (const f of readdirSync(join(root, 'web', 'chunks'))) {
    const kb = (statSync(join(root, 'web', 'chunks', f)).size / 1024).toFixed(0);
    console.log(`  web/chunks/${f}  ${kb} KB`);
  }
}
