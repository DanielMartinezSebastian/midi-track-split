// Motor de la interfaz web: carga del MIDI, reproducción, enrutado al teclado
// externo y exportación. No toca el DOM: publica su estado y la interfaz
// (ui/App.jsx) se suscribe con `subscribe` / `subscribeClock`.
import JSZip from 'jszip';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Soundfont, DrumMachine } from 'smplr';
import { splitMidi, sanitizeName, renameTrack, mergeMidi } from '../web/split-core.js';
import { gmInstrument, drumSample } from './gm.js';
import { MidiOut } from './midiout.js';
import {
  loadSoundManifest, soundfontUrl, drumMachineUrl,
  SOUNDFONT_KITS, DRUM_MACHINES,
  getSoundfontKit, setSoundfontKit, getDrumMachine, setDrumMachine,
  isKitLocal, isDrumMachineLocal,
} from './sounds.js';
// `i18n` y no `t`: aquí `t` es el nombre habitual de una pista
import { t as i18n } from './i18n.js';

const midiOut = new MidiOut();

const state = {
  fileName: '',
  stem: i18n('file.tracks'),
  originalBytes: null, // copia para reconstruir el .mid combinado
  tracks: [],   // resultado de splitMidi
  parts: [],    // { notes, muted, solo, toExternal, gain, spec, inst, part }
  duration: 0,
  cues: [],     // instantes (s) en que el fondo cambia de etapa
  timer: 0,
  playing: false,
  status: '',
  error: null,  // { message, key }
  loading: null, // promesa de carga de instrumentos
  internalMuted: false, // silenciar el sintetizador interno (sonido por el PC)
  externalMuted: false, // silenciar el envío al teclado MIDI externo
  looping: false, // repetir la canción al llegar al final
  flash: null,  // { index, key }: pista localizada con ▶
  midi: { connected: false, busy: false, error: '', deviceId: '', channel: 1, outputs: [], inputs: 0 },
  banks: { ready: false, drums: [], kits: [], drum: getDrumMachine(), kit: getSoundfontKit() },
};

// ---------- publicación del estado ----------

const listeners = new Set();
const clockListeners = new Set();
let snapshot = null;
let clock = { cur: 0, active: [] };
let errorKey = 0;
let flashKey = 0;

function buildSnapshot() {
  const solo = anySoloPC();
  return {
    fileName: state.fileName,
    loaded: state.parts.length > 0,
    duration: state.duration,
    playing: state.playing,
    status: state.status,
    error: state.error,
    looping: state.looping,
    internalMuted: state.internalMuted,
    externalMuted: state.externalMuted,
    allMuted: state.internalMuted && state.externalMuted,
    flash: state.flash,
    // El «MIDI combinado» no tiene sentido con todas las pistas silenciadas.
    canMerge: !(state.parts.length > 0 && state.parts.every((p) => p.muted)),
    tracks: state.tracks.map((t, i) => {
      const p = state.parts[i];
      const routed = !!p && routedToExt(p);
      return {
        index: i,
        name: t.name,
        notes: t.notes,
        drum: p?.spec.type === 'drum',
        label: p?.spec.type === 'drum' ? i18n('engine.drums') : (p?.spec.instrument || '').replace(/_/g, ' '),
        start: trackStart(i),
        muted: !!p?.muted,
        solo: !!p?.solo && !routed,
        toExternal: !!p?.toExternal,
        routed,
        dimmed: !!p && solo && !p.solo && !p.muted && !routed,
      };
    }),
    midi: {
      ...state.midi,
      supported: midiOut.supported,
      secureContext: midiOut.secureContext,
      enabled: midiOut.enabled,
      routedNames: extTrackNames(),
    },
    banks: state.banks,
  };
}

function emit() {
  snapshot = buildSnapshot();
  for (const fn of listeners) fn();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getState() {
  if (!snapshot) snapshot = buildSnapshot();
  return snapshot;
}
export function subscribeClock(fn) {
  clockListeners.add(fn);
  return () => clockListeners.delete(fn);
}
export function getClock() {
  return clock;
}

function showError(message) {
  state.error = { message, key: ++errorKey };
  emit();
}
function setStatus(msg) {
  state.status = msg || '';
  emit();
}

export function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function download(data, name, type = 'audio/midi') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- carga de archivo ----------

export async function loadFile(file) {
  state.error = null;
  stopPlayback();
  disposeParts();
  state.status = '';
  state.fileName = '';
  state.tracks = [];
  state.duration = 0;

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  let tracks;
  try {
    tracks = splitMidi(bytes, { includeEmpty: false });
  } catch (err) {
    showError(i18n('engine.errRead', { msg: err.message }));
    return;
  }
  if (tracks.length === 0) {
    showError(i18n('engine.errEmpty'));
    return;
  }

  state.originalBytes = bytes.slice();
  state.stem = file.name.replace(/\.(mid|midi)$/i, '') || i18n('file.tracks');
  state.tracks = tracks;
  state.fileName = file.name;
  buildPlayer(buf);
  applyAudio();
}

// ---------- reproducción ----------

const rawContext = () => Tone.getContext().rawContext;

function buildPlayer(arrayBuffer) {
  const midi = new Midi(arrayBuffer);
  state.duration = midi.duration;
  const ac = rawContext();

  state.parts = midi.tracks
    .filter((t) => t.notes.length > 0)
    .map((track) => {
      const notes = track.notes.map((n) => ({
        time: n.time,
        midi: n.midi,
        name: n.name,
        duration: n.duration,
        velocity: Math.round(n.velocity * 127),
      }));

      // gain (mute/solo) -> analizador (onda para el fondo) -> salida
      const gain = ac.createGain();
      const analyser = ac.createAnalyser();
      analyser.fftSize = WAVE_SIZE;
      gain.connect(analyser);
      analyser.connect(ac.destination);

      const spec = track.instrument.percussion
        ? { type: 'drum' }
        : { type: 'sf', instrument: gmInstrument(track.instrument.number) };

      const entry = { notes, muted: false, gain, analyser, spec, inst: null, part: null };

      entry.part = new Tone.Part((time, note) => {
        if (routedToExt(entry)) {
          // Esta pista va sólo al teclado externo.
          if (!state.externalMuted) {
            const t = domTimeFromTone(time);
            midiOut.noteOn(note.midi, note.velocity, t);
            midiOut.noteOff(note.midi, t + Math.max(0.03, note.duration) * 1000);
          }
        } else if (entry.inst && !state.internalMuted) {
          // Sintetizador interno (el gain de la pista aplica mute/solo).
          if (entry.spec.type === 'drum') {
            entry.inst.start({ note: drumSample(note.midi), time, velocity: note.velocity });
          } else {
            entry.inst.start({
              note: note.midi, time, duration: note.duration, velocity: note.velocity,
            });
          }
        }
      }, notes).start(0);

      return entry;
    });

  state.cues = buildCues(state.parts, state.duration);

  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  setPlaying(false);
  updateClock();
}

// Instancia y descarga las muestras de cada pista (perezoso, al primer play).
function ensureInstruments() {
  if (state.loading) return state.loading;
  const ac = rawContext();
  const pending = state.parts.filter((p) => !p.inst);
  if (pending.length === 0) return Promise.resolve();

  setStatus(i18n('engine.loading'));
  state.loading = loadSoundManifest()
    .then(() => {
      const loaders = pending.map((p) => {
        p.inst =
          p.spec.type === 'drum'
            ? new DrumMachine(ac, { url: drumMachineUrl(), destination: p.gain })
            : new Soundfont(ac, {
                instrumentUrl: soundfontUrl(p.spec.instrument),
                destination: p.gain,
              });
        return p.inst.load;
      });
      return Promise.allSettled(loaders);
    })
    .then(() => {
      state.loading = null;
      setStatus('');
    });
  return state.loading;
}

function disposeParts() {
  for (const p of state.parts) {
    p.part?.dispose();
    try { p.inst?.stop(); } catch {}
    try { p.inst?.disconnect(); } catch {}
    try { p.gain?.disconnect(); } catch {}
    try { p.analyser?.disconnect(); } catch {}
  }
  state.parts = [];
  state.loading = null;
}

function stopInternalNotes() {
  for (const p of state.parts) {
    try { p.inst?.stop(); } catch {}
  }
}

// Descarta las muestras cargadas de un tipo ('drum' | 'sf') para que se
// vuelvan a cargar con el banco de sonido recién elegido.
function reloadInstrumentsFor(kind) {
  let touched = false;
  for (const p of state.parts) {
    if (p.spec.type !== kind) continue;
    try { p.inst?.stop(); } catch {}
    try { p.inst?.disconnect(); } catch {}
    p.inst = null;
    touched = true;
  }
  if (touched) ensureInstruments();
}

function stopAllNotes() {
  stopInternalNotes();
  midiOut.panic();
}

// Silencia/activa el sintetizador interno (sonido por el PC).
export function setInternalMuted(muted) {
  state.internalMuted = muted;
  if (muted) stopInternalNotes();
  emit();
}

// Silencia/activa el envío de notas al teclado MIDI externo (sin des-enrutar pistas).
export function setExternalMuted(muted) {
  state.externalMuted = muted;
  if (muted) midiOut.panic();
  emit();
}

// Botón «Mute» del reproductor: silencia/activa interno + externo a la vez.
export function toggleMasterMute() {
  const muted = !(state.internalMuted && state.externalMuted);
  state.internalMuted = muted;
  state.externalMuted = muted;
  if (muted) stopAllNotes();
  emit();
}

// Convierte un tiempo del reloj de Tone (segundos de AudioContext) al dominio
// de performance.now() (ms) que usa Web MIDI para programar los mensajes.
function domTimeFromTone(toneTime) {
  const ac = rawContext();
  const ts = ac.getOutputTimestamp && ac.getOutputTimestamp();
  if (ts && ts.contextTime) {
    return ts.performanceTime + (toneTime - ts.contextTime) * 1000;
  }
  return performance.now() + (toneTime - ac.currentTime) * 1000;
}

function setPlaying(on) {
  state.playing = on;
  clearInterval(state.timer);
  if (on) state.timer = setInterval(tick, 100);
  emit();
}

export async function playPause() {
  if (state.parts.length === 0) return;
  await Tone.start();
  const tr = Tone.getTransport();
  if (tr.state === 'started') {
    tr.pause();
    stopAllNotes();
    setPlaying(false);
    updateClock();
    return;
  }
  await ensureInstruments();
  if (tr.seconds >= state.duration - 0.01) seekTo(0);
  tr.start();
  setPlaying(true);
}

export function stopPlayback() {
  Tone.getTransport().stop();
  stopAllNotes();
  seekTo(0);
  setPlaying(false);
  updateClock();
}

// Mueve el cabezal a `sec` segundos, funcione o no la reproducción.
export function seekTo(sec) {
  if (!state.parts.length || !state.duration) {
    updateClock();
    return;
  }
  const tr = Tone.getTransport();
  const clamped = Math.min(Math.max(0, sec), state.duration);
  if (!isFinite(clamped)) return;
  const wasPlaying = tr.state === 'started';
  tr.stop();
  stopAllNotes();
  tr.start(undefined, clamped);
  if (!wasPlaying) tr.pause();
  updateClock();
}

// Desplaza el cabezal `delta` segundos (flechas del teclado sobre la barra).
export function seekBy(delta) {
  seekTo(Tone.getTransport().seconds + delta);
}

function tick() {
  if (Tone.getTransport().seconds >= state.duration) {
    if (state.looping) seekTo(0);
    else stopPlayback();
    return;
  }
  updateClock();
}

// Activa/desactiva la repetición en bucle.
export function setLooping(on) {
  state.looping = on;
  emit();
}

// Publica la posición y qué pistas suenan ahora: 1 = en el PC, 2 = al teclado MIDI.
function updateClock() {
  const cur = state.duration ? Math.min(Tone.getTransport().seconds, state.duration) : 0;
  const playing = Tone.getTransport().state === 'started';
  const active = state.parts.map((p) => {
    if (!playing) return 0;
    // Ventana mínima de 180 ms para que la percusión (notas muy cortas) parpadee visible.
    const hasNote = p.notes.some(
      (n) => n.time <= cur && cur < n.time + Math.max(n.duration, 0.18)
    );
    if (!hasNote) return 0;
    if (routedToExt(p)) return 2;
    return isAudiblePC(p) ? 1 : 0;
  });
  clock = { cur, active };
  for (const fn of clockListeners) fn();
}

// Pulso de cada pista para el fondo reactivo (ui/Stage.jsx): `heard` dice si la pista está
// activa (se oye por el PC o va al teclado; ni silenciada ni fuera del solo) y `levels` su
// nivel instantáneo (0–1), que sube con cada nota según su velocidad y cae en unas décimas.
// `pitch` es la nota MIDI que domina en ese instante (0 si no suena nada).
// Se consulta en cada fotograma, así que no pasa por el estado publicado.
const pulse = { playing: false, levels: [], heard: [], pitch: [] };
export function getPulse() {
  const playing = state.playing && Tone.getTransport().state === 'started';
  const cur = playing ? Tone.getTransport().seconds : 0;
  pulse.playing = playing;
  pulse.levels.length = pulse.heard.length = pulse.pitch.length = state.parts.length;
  state.parts.forEach((p, i) => {
    const heard = routedToExt(p) ? !state.externalMuted : isAudiblePC(p) && !state.internalMuted;
    let level = 0;
    let pitch = 0;
    if (heard && playing) {
      const sustain = p.spec.type !== 'drum';
      // última nota ya empezada (las notas vienen ordenadas por tiempo)
      const notes = p.notes;
      let lo = 0;
      let hi = notes.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (notes[mid].time <= cur) { idx = mid; lo = mid + 1; } else hi = mid - 1;
      }
      // hacia atrás unas pocas notas: cubre acordes y notas largas aún sonando
      for (let k = idx; k >= 0 && k > idx - 8; k--) {
        const n = notes[k];
        const age = cur - n.time;
        const vel = n.velocity / 127;
        let v = vel * Math.exp(-age * 4);
        if (sustain && age < n.duration) v = Math.max(v, vel * 0.4);
        if (v > level) {
          level = v;
          pitch = n.midi;
        }
      }
    }
    pulse.pitch[i] = pitch;
    pulse.heard[i] = heard;
    pulse.levels[i] = level;
  });
  return pulse;
}

// Forma de onda real de la pista i (la señal que está saliendo por el PC) en `out`, un
// Float32Array de WAVE_SIZE muestras. Una pista que va al teclado MIDI, o con el sonido
// del PC silenciado, no produce audio aquí: se dibuja en su lugar el tono de su nota.
export const WAVE_SIZE = 2048;
export const sampleRate = () => rawContext().sampleRate;
export const pitchToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
export function readWave(i, out) {
  const p = state.parts[i];
  if (!p) {
    out.fill(0);
    return;
  }
  if (!routedToExt(p) && !state.internalMuted) {
    p.analyser.getFloatTimeDomainData(out);
    return;
  }
  const level = pulse.levels[i] || 0;
  const midi = pulse.pitch[i];
  if (!level || !midi) {
    out.fill(0);
    return;
  }
  const step = (2 * Math.PI * pitchToHz(midi)) / sampleRate();
  for (let n = 0; n < out.length; n++) out[n] = 0.3 * level * Math.sin(step * n);
}

// Etapas del fondo: las propias notas marcan cuándo cambia de aspecto. Hay un cambio cada
// vez que una pista entra (su primera nota, o la primera tras 1,5 s callada), con 16 s
// como mínimo entre cambios; en los tramos sin entradas se añade uno cada 30 s.
function buildCues(parts, duration) {
  const entries = [];
  for (const p of parts) {
    let end = -Infinity;
    for (const n of p.notes) {
      if (n.time - end >= 1.5) entries.push(n.time);
      end = Math.max(end, n.time + n.duration);
    }
  }
  entries.sort((a, b) => a - b);

  const cues = [];
  let last = 0;
  const fillUntil = (t) => {
    while (t - last > 40) {
      last += 30;
      cues.push(last);
    }
  };
  for (const t of entries) {
    fillUntil(t);
    if (t - last >= 16) {
      cues.push(t);
      last = t;
    }
  }
  fillUntil(duration);
  return cues;
}

// Etapa en la que está el cabezal: cuántos cambios lleva la canción hasta ese punto.
// Depende solo de la posición, así que al saltar por la barra el aspecto es coherente.
export function getStage() {
  if (!state.parts.length) return 0;
  const cur = Tone.getTransport().seconds;
  let n = 0;
  while (n < state.cues.length && state.cues[n] <= cur) n++;
  return n;
}

// ---------- silenciar / solo / salida por pista ----------

// Una pista suena por el teclado externo (y deja de sonar en el PC).
const routedToExt = (p) => !!p.toExternal && midiOut.enabled;
// El solo sólo cuenta pistas que se oyen por el PC.
const anySoloPC = () => state.parts.some((p) => p.solo && !routedToExt(p));
const isAudiblePC = (p) =>
  !routedToExt(p) && !p.muted && (!anySoloPC() || p.solo);

// Recalcula qué pistas suenan (PC + externo) y refresca la interfaz.
function applyAudio() {
  const solo = anySoloPC();
  for (const p of state.parts) {
    const audible = !routedToExt(p) && !p.muted && (!solo || p.solo);
    p.gain.gain.value = audible ? 1 : 0;
    if (!audible) { try { p.inst?.stop(); } catch {} }
  }
  emit();
}

export function setSolo(i, solo) {
  const p = state.parts[i];
  if (!p || routedToExt(p)) return;
  p.solo = solo;
  applyAudio();
}

function clearAllSolo() {
  let changed = false;
  for (const p of state.parts) if (p.solo) { p.solo = false; changed = true; }
  if (changed) applyAudio();
}

// Silencia / activa la pista i.
export function setMuted(i, muted) {
  const p = state.parts[i];
  if (!p) return;
  p.muted = muted;
  applyAudio();
}

// Enruta / desenruta la pista i hacia el teclado MIDI externo.
export function setExternal(i, on) {
  const p = state.parts[i];
  if (!p) return;
  if (on && !midiOut.enabled) return;
  p.toExternal = on;
  if (on) {
    p.solo = false;
    p.muted = false;
    try { p.inst?.stop(); } catch {}
  } else {
    midiOut.panic(); // corta notas que hubieran quedado sonando en el teclado
  }
  applyAudio();
}

// ¿Alguna pista enruta al teclado? (para el texto de estado)
function extTrackNames() {
  return state.parts
    .map((p, i) => (p.toExternal ? state.tracks[i]?.name : null))
    .filter(Boolean);
}

// ---------- pistas ----------

// Renombra la pista i; devuelve el nombre ya saneado.
export function setTrackName(i, value) {
  const t = state.tracks[i];
  if (!t) return value;
  t.name = sanitizeName(value, t.name);
  emit();
  return t.name;
}

// Instante (segundos) de la primera nota de la pista i.
function trackStart(i) {
  const notes = state.parts[i]?.notes;
  if (!notes || !notes.length) return 0;
  let min = Infinity;
  for (const n of notes) if (n.time < min) min = n.time;
  return isFinite(min) ? min : 0;
}

// Salta al inicio de la pista i y reproduce (desilenciándola si hacía falta).
export async function playFromTrack(i) {
  const p = state.parts[i];
  if (!p) return;

  if (!p.toExternal && p.muted) setMuted(i, false);
  if (anySoloPC() && !p.solo) clearAllSolo();

  await Tone.start();
  await ensureInstruments();

  const start = Math.max(0, trackStart(i) - 0.05);
  seekTo(start);
  Tone.getTransport().start();
  state.flash = { index: i, key: ++flashKey };
  setPlaying(true);
}

// Bytes del .mid con el nombre de pista actualizado (si algo falla, el original).
function exportBytes(track, name) {
  try {
    return renameTrack(track.data, name);
  } catch {
    return track.data;
  }
}

export function downloadTrack(i) {
  const t = state.tracks[i];
  if (!t) return;
  const name = sanitizeName(t.name, `${i18n('file.track')}-${i + 1}`);
  download(exportBytes(t, name), `${name}.mid`);
}

export async function downloadZip() {
  const zip = new JSZip();
  const folder = zip.folder(`${state.stem}-tracks`);
  const used = new Set();

  state.tracks.forEach((t, i) => {
    let name = sanitizeName(t.name, `${i18n('file.track')}-${i + 1}`);
    let unique = name;
    for (let n = 2; used.has(unique.toLowerCase()); n++) unique = `${name} (${n})`;
    used.add(unique.toLowerCase());
    folder.file(`${unique}.mid`, exportBytes(t, unique));
  });

  download(await zip.generateAsync({ type: 'blob' }), `${state.stem}-tracks.zip`);
}

// Descarga un único .mid con los cambios aplicados (mutear + renombrar).
export function downloadMerged() {
  if (!state.originalBytes || state.parts.length === 0) return;

  const config = state.tracks.map((t, i) => ({
    index: t.index,
    name: sanitizeName(t.name, `${i18n('file.track')}-${i + 1}`),
    muted: !!state.parts[i]?.muted,
  }));

  let bytes;
  try {
    bytes = mergeMidi(state.originalBytes, config);
  } catch (err) {
    showError(i18n('engine.errMerge', { msg: err.message }));
    return;
  }

  download(bytes, `${sanitizeName(state.stem, i18n('file.song'))} (${i18n('file.edited')}).mid`);
}

// ---------- bancos de sonido ----------

loadSoundManifest().then(() => {
  const withLocal = (label, local) => label + (local ? ` ${i18n('sound.local')}` : '');
  state.banks = {
    ready: true,
    drums: DRUM_MACHINES.map((d) => ({ id: d.id, label: withLocal(d.label, isDrumMachineLocal(d.id)) })),
    kits: SOUNDFONT_KITS.map((k) => ({ id: k.id, label: withLocal(k.label, isKitLocal(k.id)) })),
    drum: getDrumMachine(),
    kit: getSoundfontKit(),
  };
  emit();
});

export function setDrumBank(id) {
  setDrumMachine(id);
  state.banks = { ...state.banks, drum: getDrumMachine() };
  emit();
  reloadInstrumentsFor('drum');
}

export function setKitBank(id) {
  setSoundfontKit(id);
  state.banks = { ...state.banks, kit: getSoundfontKit() };
  emit();
  reloadInstrumentsFor('sf');
}

// ---------- salida MIDI externa ----------

function refreshDevices(diag) {
  const d = diag || midiOut.diagnostics();
  const outputs = d.outputs.map((o) => ({
    id: o.id,
    label: o.manufacturer ? `${o.name} (${o.manufacturer})` : o.name,
  }));
  let deviceId = state.midi.deviceId;
  if (!outputs.some((o) => o.id === deviceId)) {
    deviceId = '';
    midiOut.select(null);
  }
  state.midi = { ...state.midi, outputs, inputs: d.inputs.length, deviceId };
  applyAudio(); // reevalúa el enrutado por si cambió el dispositivo
}

export async function midiConnect() {
  if (!midiOut.supported || state.midi.busy) return;
  state.midi = { ...state.midi, busy: true, error: '' };
  emit();
  try {
    const diag = await midiOut.init();
    midiOut.onchange = (d) => refreshDevices(d);
    state.midi = { ...state.midi, busy: false, connected: true };
    refreshDevices(diag);
  } catch (err) {
    state.midi = {
      ...state.midi,
      busy: false,
      error: /permission|not granted|denied|security/i.test(err.message || '')
        ? i18n('midi.denied')
        : (err.message || i18n('midi.failed')),
    };
    emit();
  }
}

export function midiRescan() {
  refreshDevices();
}

export function midiSelect(id) {
  midiOut.select(id || null);
  state.midi = { ...state.midi, deviceId: id || '' };
  applyAudio();
}

export function midiSetChannel(ch) {
  midiOut.setChannel(ch);
  state.midi = { ...state.midi, channel: ch };
  emit();
}
