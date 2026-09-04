import JSZip from 'jszip';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Soundfont, DrumMachine } from 'smplr';
import { splitMidi, sanitizeName, renameTrack, mergeMidi } from '../src/split-core.js';
import { gmInstrument, drumSample } from './gm.js';
import { MidiOut } from './midiout.js';
import { loadSoundManifest, soundfontUrl, drumMachineUrl } from './sounds.js';

const midiOut = new MidiOut();

const $ = (id) => document.getElementById(id);
const drop = $('drop');
const fileInput = $('file');
const errorBox = $('error');

let state = {
  stem: 'pistas',
  tracks: [],   // resultado de splitMidi
  parts: [],    // { notes, muted, gain, spec, inst, part }
  rows: [],     // <li> por pista
  duration: 0,
  timer: 0,
  seeking: false,
  loading: null, // promesa de carga de instrumentos
  internalMuted: false, // silenciar el sintetizador interno (al usar MIDI externo)
};

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}
function clearError() {
  errorBox.hidden = true;
}
function setStatus(msg) {
  $('status').textContent = msg || '';
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function download(bytes, name) {
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- carga de archivo ----------

async function handleFile(file) {
  clearError();
  stopPlayback();
  disposeParts();
  setStatus('');

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  state.originalBytes = bytes.slice(); // copia para reconstruir el .mid combinado
  state.stem = file.name.replace(/\.(mid|midi)$/i, '') || 'pistas';
  $('filename').textContent = file.name;

  try {
    state.tracks = splitMidi(bytes, { includeEmpty: false });
  } catch (err) {
    showError(`No se pudo leer el MIDI: ${err.message}`);
    return;
  }
  if (state.tracks.length === 0) {
    showError('El archivo no contiene pistas con notas.');
    return;
  }

  buildPlayer(buf);
  renderTracks();
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

      const gain = ac.createGain();
      gain.connect(ac.destination);

      const spec = track.instrument.percussion
        ? { type: 'drum' }
        : { type: 'sf', instrument: gmInstrument(track.instrument.number) };

      const entry = { notes, muted: false, gain, spec, inst: null, part: null };

      entry.part = new Tone.Part((time, note) => {
        if (routedToExt(entry)) {
          // Esta pista va sólo al teclado externo.
          const t = domTimeFromTone(time);
          midiOut.noteOn(note.midi, note.velocity, t);
          midiOut.noteOff(note.midi, t + Math.max(0.03, note.duration) * 1000);
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

  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  setPlaying(false);
  $('player').hidden = false;
  updateClock();
}

// Instancia y descarga las muestras de cada pista (perezoso, al primer play).
function ensureInstruments() {
  if (state.loading) return state.loading;
  const ac = rawContext();
  const pending = state.parts.filter((p) => !p.inst);
  if (pending.length === 0) return Promise.resolve();

  setStatus('Cargando instrumentos…');
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
      setStatus('');
      state.loading = null;
    });
  return state.loading;
}

function disposeParts() {
  for (const p of state.parts) {
    p.part?.dispose();
    try { p.inst?.stop(); } catch {}
    try { p.inst?.disconnect(); } catch {}
    try { p.gain?.disconnect(); } catch {}
  }
  state.parts = [];
  state.loading = null;
}

function stopInternalNotes() {
  for (const p of state.parts) {
    try { p.inst?.stop(); } catch {}
  }
}

function stopAllNotes() {
  stopInternalNotes();
  midiOut.panic();
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
  $('play').textContent = on ? '⏸ Pausa' : '▶ Reproducir';
  clearInterval(state.timer);
  if (on) state.timer = setInterval(tick, 100);
}

async function playPause() {
  if (state.parts.length === 0) return;
  await Tone.start();
  const tr = Tone.getTransport();
  if (tr.state === 'started') {
    tr.pause();
    stopAllNotes();
    setPlaying(false);
    return;
  }
  await ensureInstruments();
  if (tr.seconds >= state.duration - 0.01) seekTo(0);
  tr.start();
  setPlaying(true);
}

function stopPlayback() {
  Tone.getTransport().stop();
  stopAllNotes();
  seekTo(0);
  setPlaying(false);
}

// Mueve el cabezal a `sec` segundos, funcione o no la reproducción.
function seekTo(sec) {
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

function tick() {
  if (state.seeking) return;
  if (Tone.getTransport().seconds >= state.duration) {
    stopPlayback();
    return;
  }
  updateClock();
}

function updateClock() {
  const cur = Math.min(Tone.getTransport().seconds, state.duration);
  const pct = state.duration ? (cur / state.duration) * 100 : 0;
  $('time').textContent = `${fmt(cur)} / ${fmt(state.duration)}`;
  $('bar').style.width = `${pct}%`;
  $('progress').setAttribute('aria-valuenow', Math.round(cur));
  highlightActive(cur);
}

// Ilumina las pistas según lo que suena: verde = en el PC, lila = al teclado MIDI.
function highlightActive(cur) {
  const playing = Tone.getTransport().state === 'started';
  state.parts.forEach((p, i) => {
    const row = state.rows[i];
    if (!row) return;
    // Ventana mínima de 180 ms para que la percusión (notas muy cortas) parpadee visible.
    const hasNote = p.notes.some(
      (n) => n.time <= cur && cur < n.time + Math.max(n.duration, 0.18)
    );
    row.classList.toggle('playing', playing && isAudiblePC(p) && hasNote);
    row.classList.toggle('playing-ext', playing && routedToExt(p) && hasNote);
  });
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
  state.parts.forEach((p, i) => {
    const routed = routedToExt(p);
    const audible = !routed && !p.muted && (!solo || p.solo);
    p.gain.gain.value = audible ? 1 : 0;
    if (!audible) { try { p.inst?.stop(); } catch {} }

    if (p.soloBtn) {
      p.soloBtn.classList.toggle('is-solo', !!p.solo && !routed);
      p.soloBtn.disabled = routed;
      p.soloBtn.setAttribute('aria-pressed', String(!!p.solo && !routed));
    }
    if (p.muteBtn) p.muteBtn.disabled = routed;
    if (p.extBtn) {
      p.extBtn.classList.toggle('is-ext', !!p.toExternal);
      p.extBtn.disabled = !midiOut.enabled;
      p.extBtn.setAttribute('aria-pressed', String(!!p.toExternal));
    }

    const row = state.rows[i];
    if (row) {
      row.classList.toggle('routed', routed);
      row.classList.toggle('dimmed', solo && !p.solo && !p.muted && !routed);
    }
  });
  updateMidiStatus();
}

function setSolo(i, solo) {
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

// Enruta / desenruta la pista i hacia el teclado MIDI externo.
function setExternal(i, on) {
  const p = state.parts[i];
  if (!p) return;
  if (on && !midiOut.enabled) return;
  p.toExternal = on;
  if (on) {
    p.solo = false;
    p.muted = false;
    applyMuteUi(i, false);
    try { p.inst?.stop(); } catch {}
  } else {
    midiOut.panic(); // corta notas que hubieran quedado sonando en el teclado
  }
  applyAudio();
  updateMergeButton();
}

// ¿Alguna pista enruta al teclado? (para el texto de estado)
function extTrackNames() {
  return state.parts
    .map((p, i) => (p.toExternal ? state.tracks[i]?.name : null))
    .filter(Boolean);
}

// ---------- desplazar el punto de reproducción ----------

function ratioFromEvent(e) {
  const rect = $('progress').getBoundingClientRect();
  if (!rect.width) return 0;
  const ratio = (e.clientX - rect.left) / rect.width;
  return isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
}

// Sólo mueve el indicador visual mientras se arrastra.
function previewSeek(ratio) {
  $('bar').style.width = `${ratio * 100}%`;
  $('time').textContent = `${fmt(ratio * state.duration)} / ${fmt(state.duration)}`;
}

function initSeek() {
  const el = $('progress');
  el.addEventListener('pointerdown', (e) => {
    if (!state.duration) return;
    state.seeking = true;
    try { el.setPointerCapture(e.pointerId); } catch {}
    previewSeek(ratioFromEvent(e));
  });
  el.addEventListener('pointermove', (e) => {
    if (state.seeking) previewSeek(ratioFromEvent(e));
  });
  el.addEventListener('pointerup', (e) => {
    if (!state.seeking) return;
    state.seeking = false;
    state.pointerSeeked = true;
    try { el.releasePointerCapture(e.pointerId); } catch {}
    seekTo(ratioFromEvent(e) * state.duration);
  });
  el.addEventListener('pointercancel', () => {
    state.seeking = false;
    updateClock();
  });
  // Clic simple para saltar (cubre entradas que no emiten eventos pointer).
  el.addEventListener('click', (e) => {
    if (state.pointerSeeked) { state.pointerSeeked = false; return; }
    if (state.duration) seekTo(ratioFromEvent(e) * state.duration);
  });
  el.addEventListener('keydown', (e) => {
    if (!state.duration) return;
    const step = e.shiftKey ? 5 : 1;
    const cur = Tone.getTransport().seconds;
    if (e.key === 'ArrowRight') seekTo(cur + step);
    else if (e.key === 'ArrowLeft') seekTo(cur - step);
    else return;
    e.preventDefault();
  });
}

// ---------- lista de pistas ----------

function renderTracks() {
  const list = $('track-list');
  list.innerHTML = '';
  state.rows = [];

  state.tracks.forEach((t, i) => {
    const li = document.createElement('li');
    state.rows[i] = li;

    const part = state.parts[i];
    const label = part?.spec.type === 'drum'
      ? 'batería'
      : (part?.spec.instrument || '').replace(/_/g, ' ');

    const info = document.createElement('div');
    info.className = 'tinfo';

    const nameInput = document.createElement('input');
    nameInput.className = 'tname-input';
    nameInput.value = t.name;
    nameInput.setAttribute('aria-label', `Nombre de la pista ${i + 1}`);
    nameInput.spellcheck = false;
    const commit = () => {
      const v = sanitizeName(nameInput.value, t.name);
      t.name = v;
      nameInput.value = v;
    };
    nameInput.addEventListener('change', commit);
    nameInput.addEventListener('blur', commit);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nameInput.blur();
    });

    const start = trackStart(i);
    const meta = document.createElement('div');
    meta.className = 'tmeta';
    meta.textContent =
      `${t.notes} notas${label ? ` · ${label}` : ''}` +
      (start > 0.05 ? ` · empieza ${fmt(start)}` : '');

    info.append(nameInput, meta);

    const spacer = document.createElement('div');
    spacer.className = 'spacer';

    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'btn ghost solo-btn';
    soloBtn.textContent = 'S';
    soloBtn.title = 'Escuchar solo esta pista';
    soloBtn.setAttribute('aria-label', 'Escuchar solo esta pista');
    soloBtn.setAttribute('aria-pressed', 'false');
    soloBtn.addEventListener('click', () => setSolo(i, !state.parts[i]?.solo));
    if (part) part.soloBtn = soloBtn;

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'btn ghost mute-btn';
    muteBtn.textContent = 'Mute';
    muteBtn.addEventListener('click', () => setMuted(i, !state.parts[i]?.muted));
    if (part) part.muteBtn = muteBtn;
    applyMuteUi(i, part?.muted || false);

    const extBtn = document.createElement('button');
    extBtn.type = 'button';
    extBtn.className = 'btn ghost ext-btn';
    extBtn.textContent = 'EXT';
    extBtn.title = 'Enviar solo esta pista al teclado MIDI (deja de sonar en el PC)';
    extBtn.setAttribute('aria-label', extBtn.title);
    extBtn.setAttribute('aria-pressed', 'false');
    extBtn.disabled = !midiOut.enabled;
    extBtn.addEventListener('click', () => setExternal(i, !state.parts[i]?.toExternal));
    if (part) part.extBtn = extBtn;

    const locate = document.createElement('button');
    locate.type = 'button';
    locate.className = 'btn ghost locate';
    locate.textContent = '▶';
    locate.title = 'Reproducir desde el inicio de esta pista';
    locate.setAttribute('aria-label', 'Reproducir desde el inicio de esta pista');
    locate.addEventListener('click', () => playFromTrack(i));

    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'btn ghost';
    dl.textContent = '⬇ .mid';
    dl.addEventListener('click', () => {
      const name = sanitizeName(t.name, `pista-${i + 1}`);
      download(exportBytes(t, name), `${name}.mid`);
    });

    li.append(info, spacer, soloBtn, muteBtn, extBtn, locate, dl);
    list.append(li);
  });

  applyAudio();
  updateMergeButton();
  $('tracks').hidden = false;
}

// Silencia / activa la pista i y refresca la interfaz.
function setMuted(i, muted) {
  const p = state.parts[i];
  if (!p) return;
  p.muted = muted;
  applyMuteUi(i, muted);
  applyAudio();
  updateMergeButton();
}

function applyMuteUi(i, muted) {
  const btn = state.parts[i]?.muteBtn;
  if (btn) {
    btn.textContent = muted ? 'Muted' : 'Mute';
    btn.title = muted ? 'Pista silenciada — pulsa para activar' : 'Silenciar pista';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-pressed', String(muted));
    btn.classList.toggle('is-muted', muted);
  }
  state.rows[i]?.classList.toggle('muted', muted);
}

// El botón "MIDI combinado" se desactiva si están todas las pistas silenciadas.
function updateMergeButton() {
  const btn = $('merge');
  if (!btn) return;
  const allMuted = state.parts.length > 0 && state.parts.every((p) => p.muted);
  btn.disabled = allMuted;
  btn.title = allMuted
    ? 'Activa al menos una pista para exportar'
    : 'Descarga un solo .mid sin las pistas silenciadas y con los nombres nuevos';
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
async function playFromTrack(i) {
  const p = state.parts[i];
  if (!p) return;

  if (!p.toExternal && p.muted) setMuted(i, false);
  if (anySoloPC() && !p.solo) clearAllSolo();

  await Tone.start();
  await ensureInstruments();

  const start = Math.max(0, trackStart(i) - 0.05);
  seekTo(start);
  Tone.getTransport().start();
  setPlaying(true);
  flashRow(i);
}

// Parpadeo para señalar visualmente la pista localizada.
let flashTimer = 0;
function flashRow(i) {
  state.rows.forEach((row) => row?.classList.remove('locating'));
  const row = state.rows[i];
  if (!row) return;
  row.classList.add('locating');
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => row.classList.remove('locating'), 1200);
}

// Bytes del .mid con el nombre de pista actualizado (si algo falla, el original).
function exportBytes(track, name) {
  try {
    return renameTrack(track.data, name);
  } catch {
    return track.data;
  }
}

async function downloadZip() {
  const zip = new JSZip();
  const folder = zip.folder(`${state.stem}-tracks`);
  const used = new Set();

  state.tracks.forEach((t, i) => {
    let name = sanitizeName(t.name, `pista-${i + 1}`);
    let unique = name;
    for (let n = 2; used.has(unique.toLowerCase()); n++) unique = `${name} (${n})`;
    used.add(unique.toLowerCase());
    folder.file(`${unique}.mid`, exportBytes(t, unique));
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.stem}-tracks.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Descarga un único .mid con los cambios aplicados (mutear + renombrar).
function downloadMerged() {
  if (!state.originalBytes || state.parts.length === 0) return;

  const config = state.tracks.map((t, i) => ({
    index: t.index,
    name: sanitizeName(t.name, `pista-${i + 1}`),
    muted: !!state.parts[i]?.muted,
  }));

  let bytes;
  try {
    bytes = mergeMidi(state.originalBytes, config);
  } catch (err) {
    showError(`No se pudo generar el MIDI combinado: ${err.message}`);
    return;
  }

  download(bytes, `${sanitizeName(state.stem, 'cancion')} (editado).mid`);
}

// ---------- eventos UI ----------

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

['dragenter', 'dragover'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  })
);
drop.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

$('play').addEventListener('click', playPause);
$('stop').addEventListener('click', stopPlayback);
$('zip').addEventListener('click', downloadZip);
$('merge').addEventListener('click', downloadMerged);
initSeek();
initMidiOut();

// ---------- salida MIDI externa ----------

let midiLastInputs = 0;

// Texto de estado del panel MIDI (lo llama initMidiOut y applyAudio).
function updateMidiStatus() {
  const status = $('midi-status');
  if (!status || status.dataset.locked === '1') return; // no pisar un error mostrado
  if (!midiOut.access) { status.textContent = ''; return; } // aún sin conectar

  if (midiOut.enabled) {
    const name = $('midi-device').selectedOptions[0]?.textContent || 'dispositivo';
    const ch = $('midi-channel').value;
    const routed = extTrackNames();
    status.textContent =
      `Teclado “${name}” · canal ${ch} — ` +
      (routed.length
        ? `enviando: ${routed.join(', ')}`
        : 'pulsa EXT en una pista para enviarla');
    return;
  }
  if (midiOut.outputs().length > 0) {
    status.textContent = 'Elige un dispositivo de salida en la lista.';
  } else if (midiLastInputs > 0) {
    status.textContent =
      'Se detectan entradas MIDI pero ninguna salida. Tu aparato parece un ' +
      'controlador (solo envía notas): para oírlo hace falta un dispositivo con ' +
      'generador de sonido, o un puerto virtual tipo loopMIDI hacia un DAW.';
  } else {
    status.textContent =
      'MIDI activado, pero no se detecta ningún dispositivo. Prueba a: reconectar ' +
      'el aparato, cerrar otras apps que lo estén usando y reiniciar el navegador; ' +
      'luego pulsa «Buscar de nuevo».';
  }
}

function initMidiOut() {
  const connectBtn = $('midi-connect');
  const controls = $('midi-controls');
  const deviceSel = $('midi-device');
  const channelSel = $('midi-channel');
  const internalChk = $('midi-mute-internal');
  const rescanBtn = $('midi-rescan');
  const status = $('midi-status');

  for (let c = 1; c <= 16; c++) {
    const o = document.createElement('option');
    o.value = String(c);
    o.textContent = `Canal ${c}`;
    channelSel.append(o);
  }
  channelSel.value = '1';

  function refreshDevices(diag) {
    const d = diag || midiOut.diagnostics();
    midiLastInputs = d.inputs.length;
    const current = deviceSel.value;
    deviceSel.innerHTML = '<option value="">— ninguno —</option>';
    for (const o of d.outputs) {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.manufacturer ? `${o.name} (${o.manufacturer})` : o.name;
      deviceSel.append(opt);
    }
    if (d.outputs.some((o) => o.id === current)) {
      deviceSel.value = current;
    } else {
      deviceSel.value = '';
      midiOut.select(null);
    }
    applyAudio(); // reevalúa el enrutado por si cambió el dispositivo
  }

  if (!midiOut.supported) {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Teclado MIDI no disponible';
    status.dataset.locked = '1';
    status.innerHTML = midiOut.secureContext
      ? 'Este navegador no soporta Web MIDI. Usa Chrome, Edge u Opera (en Brave, actívalo en <code>brave://settings/content/midi</code>).'
      : 'Web MIDI solo funciona en conexión segura, y estás entrando por <code>http://</code> + IP. Opciones:<br>' +
        '· en el mismo equipo, abre <code>http://localhost:' + location.port + '</code>;<br>' +
        '· o arranca el servidor con <code>npm run web:https</code> y entra por <code>https://</code>;<br>' +
        '· o en Chrome añade este origen en <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> y reinícialo.';
    return;
  }

  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    try {
      const diag = await midiOut.init();
      midiOut.onchange = (d) => refreshDevices(d);
      connectBtn.hidden = true;
      controls.hidden = false;
      delete status.dataset.locked;
      refreshDevices(diag);
    } catch (err) {
      connectBtn.disabled = false;
      status.dataset.locked = '1';
      status.textContent = /permission|not granted|denied|security/i.test(err.message || '')
        ? 'No se concedió permiso para usar MIDI. Permítelo en el icono de ajustes junto a la URL (o en chrome://settings/content/midi) y vuelve a pulsar el botón.'
        : (err.message || 'No se pudo acceder a los dispositivos MIDI.');
    }
  });

  rescanBtn.addEventListener('click', () => refreshDevices());

  deviceSel.addEventListener('change', () => {
    midiOut.select(deviceSel.value || null);
    applyAudio();
  });
  channelSel.addEventListener('change', () => {
    midiOut.setChannel(+channelSel.value);
    updateMidiStatus();
  });
  internalChk.addEventListener('change', () => {
    state.internalMuted = internalChk.checked;
    if (internalChk.checked) stopInternalNotes();
  });
}
