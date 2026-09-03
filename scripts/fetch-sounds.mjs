// Descarga las muestras de sonido a web/soundfonts/ para que la web funcione
// sin internet.
//
//   node scripts/fetch-sounds.mjs               instrumentos esenciales + batería
//   node scripts/fetch-sounds.mjs --all         los 128 instrumentos GM (~300 MB)
//   node scripts/fetch-sounds.mjs flute cello   solo esos instrumentos
//
// La batería (TR-808, ~700 KB) se descarga siempre.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SF_DIR = join(root, 'web', 'soundfonts');
const SF_CDN = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite';
const DM_CDN = 'https://smpldsnds.github.io/drum-machines/TR-808';

const ALL_INSTRUMENTS = JSON.parse(
  await readFile(join(root, 'scripts', 'gm-instruments.json'), 'utf8')
);

const ESSENTIAL = [
  'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_piano_1', 'electric_piano_2',
  'harpsichord', 'drawbar_organ', 'church_organ', 'rock_organ',
  'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_clean', 'overdriven_guitar',
  'distortion_guitar', 'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick',
  'fretless_bass', 'slap_bass_1', 'synth_bass_1', 'synth_bass_2',
  'violin', 'viola', 'cello', 'contrabass', 'pizzicato_strings', 'tremolo_strings',
  'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'choir_aahs', 'voice_oohs',
  'orchestra_hit', 'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn',
  'brass_section', 'synth_brass_1', 'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
  'oboe', 'english_horn', 'bassoon', 'clarinet', 'flute', 'piccolo', 'recorder', 'pan_flute',
  'lead_1_square', 'lead_2_sawtooth', 'pad_1_new_age', 'pad_2_warm', 'fx_3_crystal',
  'sitar', 'banjo', 'kalimba', 'steel_drums', 'synth_drum', 'taiko_drum',
  'vibraphone', 'marimba', 'xylophone', 'glockenspiel', 'music_box', 'tubular_bells', 'timpani',
];

const args = process.argv.slice(2);
let instruments;
if (args.includes('--all')) {
  instruments = ALL_INSTRUMENTS;
} else {
  const named = args.filter((a) => !a.startsWith('--'));
  instruments = named.length ? named : ESSENTIAL;
}
instruments = instruments.filter((i) => ALL_INSTRUMENTS.includes(i));

async function download(url, dest, { skipIfExists = true } = {}) {
  if (skipIfExists && existsSync(dest)) return 'skip';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, new Uint8Array(await res.arrayBuffer()));
  return 'ok';
}

// --- instrumentos ---
console.log(`Instrumentos: ${instruments.length}`);
let done = 0;
for (const name of instruments) {
  try {
    const r = await download(
      `${SF_CDN}/${name}-mp3.js`,
      join(SF_DIR, 'musyngkite', `${name}-mp3.js`)
    );
    done++;
    process.stdout.write(`\r  ${done}/${instruments.length}  ${name}${' '.repeat(20)}`);
    if (r === 'ok') { /* descargado */ }
  } catch (e) {
    console.warn(`\n  ! ${name}: ${e.message}`);
  }
}
console.log();

// --- batería TR-808 ---
console.log('Batería TR-808…');
const dm = await fetch(`${DM_CDN}/dm.json`).then((r) => r.json());
await mkdir(join(SF_DIR, 'tr-808'), { recursive: true });
await writeFile(join(SF_DIR, 'tr-808', 'dm.json'), JSON.stringify(dm));
let ds = 0;
for (const sample of dm.samples) {
  try {
    await download(`${DM_CDN}/${sample}.ogg`, join(SF_DIR, 'tr-808', `${sample}.ogg`));
    ds++;
    process.stdout.write(`\r  ${ds}/${dm.samples.length}`);
  } catch (e) {
    console.warn(`\n  ! ${sample}: ${e.message}`);
  }
}
console.log();

// --- manifiesto ---
const manifest = {
  instruments: (
    await Promise.all(
      ALL_INSTRUMENTS.map(async (n) =>
        existsSync(join(SF_DIR, 'musyngkite', `${n}-mp3.js`)) ? n : null
      )
    )
  ).filter(Boolean),
  drums: existsSync(join(SF_DIR, 'tr-808', 'dm.json')),
};
await writeFile(join(SF_DIR, 'manifest.json'), JSON.stringify(manifest, null, 0));

console.log(
  `\nListo: ${manifest.instruments.length}/128 instrumentos` +
    `${manifest.drums ? ' + batería' : ''} en web/soundfonts/` +
    (manifest.instruments.length < 128
      ? '\n(usa  npm run fetch-sounds -- --all  para los 128)'
      : '')
);
