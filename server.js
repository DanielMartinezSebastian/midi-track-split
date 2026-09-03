// Servidor estático mínimo para servir la carpeta web/.
//   node server.js            -> HTTP  (http://localhost:4173)
//   node server.js --https    -> HTTPS con certificado autofirmado, necesario para
//                                usar Web MIDI desde otro equipo (contexto seguro).
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const BASE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(BASE, 'web');
const PORT = process.env.PORT || 4173;
const USE_HTTPS = process.argv.includes('--https') || process.env.HTTPS === '1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mid': 'audio/midi',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
};

function lanIPv4() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

// Certificado autofirmado, cacheado en .cert/ y regenerado si cambian las IP.
async function ensureCert(ips) {
  const dir = join(BASE, '.cert');
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  const metaPath = join(dir, 'meta.json');
  const want = JSON.stringify([...ips].sort());

  try {
    const meta = await readFile(metaPath, 'utf8');
    if (meta === want) {
      return { key: await readFile(keyPath), cert: await readFile(certPath) };
    }
  } catch {}

  const { default: selfsigned } = await import('selfsigned');
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'midi-track-split' }], {
    days: 825,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  await mkdir(dir, { recursive: true });
  await writeFile(keyPath, pems.private);
  await writeFile(certPath, pems.cert);
  await writeFile(metaPath, want);
  return { key: pems.private, cert: pems.cert };
}

async function handler(req, res) {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.[/\\])+/, '');
    // El núcleo compartido vive en /src; el resto se sirve desde /web.
    const isShared = rel.replace(/\\/g, '/').startsWith('/src/');
    const dir = isShared ? BASE : ROOT;
    const filePath = join(dir, rel);
    if (!filePath.startsWith(dir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const ips = lanIPv4();

function announce(scheme) {
  console.log(`\n  Interfaz web (${scheme.toUpperCase()}):`);
  console.log(`    ${scheme}://localhost:${PORT}`);
  for (const ip of ips) console.log(`    ${scheme}://${ip}:${PORT}`);
  if (scheme === 'https') {
    console.log('\n  Certificado autofirmado: el navegador avisará una vez');
    console.log('  (Avanzado -> Continuar). Necesario para Web MIDI fuera de localhost.\n');
  } else if (ips.length) {
    console.log('\n  Para Web MIDI desde otro equipo hace falta HTTPS:  npm run web:https\n');
  }
}

if (USE_HTTPS) {
  ensureCert(ips).then(({ key, cert }) => {
    createHttps({ key, cert }, handler).listen(PORT, () => announce('https'));
  });
} else {
  createHttp(handler).listen(PORT, () => announce('http'));
}
