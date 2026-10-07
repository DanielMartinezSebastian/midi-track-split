// Empaqueta la interfaz (ui/, React + trama-ui) en web/app.js y web/app.css.
// Las librerías de web/vendor/ quedan fuera: las resuelve el import map de index.html.
//   node scripts/build-ui.mjs           -> build minificado
//   node scripts/build-ui.mjs --watch   -> recompila al guardar (sin minificar)
import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { app: join(root, 'ui', 'main.jsx') },
  outdir: join(root, 'web'),
  bundle: true,
  format: 'esm',
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

if (watch) {
  const ctx = await context({ ...options, logLevel: 'info' });
  await ctx.watch();
} else {
  await build(options);
  for (const f of ['app.js', 'app.css']) {
    const kb = (statSync(join(root, 'web', f)).size / 1024).toFixed(0);
    console.log(`  web/${f}  ${kb} KB`);
  }
}
