// Resuelve de dónde salen las muestras de sonido: de web/soundfonts/ si se han
// descargado con `npm run fetch-sounds`, o de un CDN como respaldo. Soporta
// varios bancos intercambiables: kits de instrumentos y cajas de ritmos.

const LOCAL = '/soundfonts';
const CDN_SOUNDFONT = 'https://gleitz.github.io/midi-js-soundfonts';
const CDN_DRUMS = 'https://smpldsnds.github.io/drum-machines';

export const SOUNDFONT_KITS = [
  { id: 'MusyngKite', label: 'MusyngKite', folder: 'musyngkite' },
  { id: 'FluidR3_GM', label: 'FluidR3 GM', folder: 'fluidr3_gm' },
];

export const DRUM_MACHINES = [
  { id: 'TR-808', label: 'TR-808', slug: 'TR-808', folder: 'tr-808' },
  { id: 'Casio-RZ1', label: 'Casio RZ-1', slug: 'Casio-RZ1', folder: 'casio-rz1' },
  { id: 'LM-2', label: 'LinnDrum LM-2', slug: 'LM-2', folder: 'lm-2' },
  { id: 'MFB-512', label: 'MFB-512', slug: 'MFB-512', folder: 'mfb-512' },
  { id: 'Roland CR-8000', label: 'Roland CR-8000', slug: 'Roland-CR-8000', folder: 'roland-cr-8000' },
];

const DEFAULT_KIT = SOUNDFONT_KITS[0].id;
const DEFAULT_DRUM_MACHINE = DRUM_MACHINES[0].id;

let manifest = { kit: DEFAULT_KIT, drumMachine: DEFAULT_DRUM_MACHINE, instruments: [], drums: false };
let loaded = null;

let currentKit = DEFAULT_KIT;
let currentDrumMachine = DEFAULT_DRUM_MACHINE;

function kitInfo(id) {
  return SOUNDFONT_KITS.find((k) => k.id === id) || SOUNDFONT_KITS[0];
}
function drumInfo(id) {
  return DRUM_MACHINES.find((d) => d.id === id) || DRUM_MACHINES[0];
}

export function loadSoundManifest() {
  if (!loaded) {
    loaded = fetch(`${LOCAL}/manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m && Array.isArray(m.instruments)) {
          manifest = { kit: DEFAULT_KIT, drumMachine: DEFAULT_DRUM_MACHINE, drums: false, ...m };
        }
      })
      .catch(() => {});
  }
  return loaded;
}

export function getSoundfontKit() {
  return currentKit;
}
export function setSoundfontKit(id) {
  currentKit = kitInfo(id).id;
}

export function getDrumMachine() {
  return currentDrumMachine;
}
export function setDrumMachine(id) {
  currentDrumMachine = drumInfo(id).id;
}

export function soundfontUrl(instrument) {
  const kit = kitInfo(currentKit);
  const isLocal = manifest.kit === kit.id && manifest.instruments.includes(instrument);
  return isLocal
    ? `${LOCAL}/${kit.folder}/${instrument}-mp3.js`
    : `${CDN_SOUNDFONT}/${kit.id}/${instrument}-mp3.js`;
}

export function drumMachineUrl() {
  const dm = drumInfo(currentDrumMachine);
  const isLocal = manifest.drumMachine === dm.id && manifest.drums;
  return isLocal
    ? `${LOCAL}/${dm.folder}/dm.json`
    : `${CDN_DRUMS}/${dm.slug}/dm.json`;
}

// ¿Tiene el kit/caja de ritmos indicado (o el elegido ahora mismo) muestras locales?
export function isKitLocal(id = currentKit) {
  return manifest.kit === id && manifest.instruments.length > 0;
}
export function isDrumMachineLocal(id = currentDrumMachine) {
  return manifest.drumMachine === id && manifest.drums;
}

// ¿Está todo el audio del banco elegido disponible en local? (para avisar en la interfaz)
export function soundsAreLocal() {
  return isDrumMachineLocal() && isKitLocal() && manifest.instruments.length >= 128;
}

export function localInstrumentCount() {
  return isKitLocal() ? manifest.instruments.length : 0;
}
