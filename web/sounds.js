// Resuelve de dónde salen las muestras de sonido: de web/soundfonts/ si se han
// descargado con `npm run fetch-sounds`, o del CDN como respaldo.

const LOCAL = '/soundfonts';
const CDN_SOUNDFONT = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite';
const CDN_DRUMS = 'https://smpldsnds.github.io/drum-machines/TR-808/dm.json';

let manifest = { instruments: [], drums: false };
let loaded = null;

export function loadSoundManifest() {
  if (!loaded) {
    loaded = fetch(`${LOCAL}/manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m && Array.isArray(m.instruments)) manifest = m;
      })
      .catch(() => {});
  }
  return loaded;
}

export function soundfontUrl(instrument) {
  return manifest.instruments.includes(instrument)
    ? `${LOCAL}/musyngkite/${instrument}-mp3.js`
    : `${CDN_SOUNDFONT}/${instrument}-mp3.js`;
}

export function drumMachineUrl() {
  return manifest.drums ? `${LOCAL}/tr-808/dm.json` : CDN_DRUMS;
}

// ¿Está todo el audio disponible en local? (para avisar en la interfaz)
export function soundsAreLocal() {
  return manifest.drums && manifest.instruments.length >= 128;
}

export function localInstrumentCount() {
  return manifest.instruments.length;
}
