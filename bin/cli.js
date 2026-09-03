#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import JSZip from 'jszip';
import { splitMidi } from '../src/split-core.js';

const HELP = `midi-track-split — separa un archivo MIDI en pistas individuales

Uso:
  midi-track-split <entrada.mid> [opciones]

Opciones:
  -o, --out <carpeta>   Carpeta de salida (por defecto: <nombre>-tracks)
  -z, --zip [archivo]   Genera además un .zip con todas las pistas
      --only-zip        Genera sólo el .zip (no escribe los .mid sueltos)
      --include-empty   Incluye también pistas sin notas
  -h, --help            Muestra esta ayuda

Ejemplos:
  midi-track-split cancion.mid
  midi-track-split cancion.mid -o pistas --zip
  midi-track-split cancion.mid --only-zip cancion-pistas.zip
`;

function parseArgs(argv) {
  const opts = { input: null, out: null, zip: false, zipPath: null, onlyZip: false, includeEmpty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-o' || a === '--out') opts.out = argv[++i];
    else if (a === '-z' || a === '--zip') {
      opts.zip = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) opts.zipPath = argv[++i];
    } else if (a === '--only-zip') {
      opts.onlyZip = true;
      opts.zip = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) opts.zipPath = argv[++i];
    } else if (a === '--include-empty') opts.includeEmpty = true;
    else if (!a.startsWith('-') && !opts.input) opts.input = a;
    else {
      console.error(`Opción no reconocida: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log(HELP);
    process.exit(opts.input ? 0 : 1);
  }

  const inputPath = resolve(opts.input);
  const stem = basename(inputPath, extname(inputPath));
  const bytes = await readFile(inputPath);

  let tracks;
  try {
    tracks = splitMidi(bytes, { includeEmpty: opts.includeEmpty });
  } catch (err) {
    console.error(`No se pudo leer el MIDI: ${err.message}`);
    process.exit(1);
  }

  if (tracks.length === 0) {
    console.error('El archivo no contiene pistas con notas. Usa --include-empty para forzar.');
    process.exit(1);
  }

  const outDir = resolve(opts.out || `${stem}-tracks`);

  if (!opts.onlyZip) {
    await mkdir(outDir, { recursive: true });
    for (const t of tracks) {
      const file = join(outDir, `${t.name}.mid`);
      await writeFile(file, t.data);
      console.log(`  ✓ ${t.name}.mid  (${t.notes} notas)`);
    }
    console.log(`\n${tracks.length} pistas escritas en ${outDir}`);
  }

  if (opts.zip) {
    const zip = new JSZip();
    for (const t of tracks) zip.file(`${t.name}.mid`, t.data);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = resolve(opts.zipPath || `${stem}-tracks.zip`);
    await writeFile(zipPath, buf);
    console.log(`ZIP creado: ${zipPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
