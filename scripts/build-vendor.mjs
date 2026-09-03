// Empaqueta las librerías de node_modules en archivos ESM autocontenidos
// dentro de web/vendor/, para que la web no dependa de ningún CDN.
//   node scripts/build-vendor.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const entries = join(root, 'scripts', 'vendor-entries');
const outdir = join(root, 'web', 'vendor');

const libs = ['tone', 'smplr', 'jszip', 'tonejs-midi', 'midi-file'];

await build({
  entryPoints: libs.map((l) => join(entries, `${l}.js`)),
  outdir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
});

for (const l of libs) {
  const kb = (statSync(join(outdir, `${l}.js`)).size / 1024).toFixed(0);
  console.log(`  web/vendor/${l}.js  ${kb} KB`);
}
console.log('\nListo. Actualiza el import map de web/index.html si cambian los nombres.');
