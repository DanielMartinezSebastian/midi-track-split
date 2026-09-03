// Núcleo compartido entre la CLI y la web.
// Sólo depende de "midi-file" (JS puro), así que funciona en Node y en el navegador.
import { parseMidi, writeMidi } from 'midi-file';

// Eventos meta que describen el "mapa" global de la canción y que conviene
// conservar en cada pista aislada para que suene con el tempo correcto.
const GLOBAL_META = new Set([
  'setTempo',
  'timeSignature',
  'keySignature',
  'smpteOffset',
]);

function isNoteTrack(events) {
  return events.some((e) => e.type === 'noteOn' && e.velocity > 0);
}

function trackName(events, index) {
  const named = events.find((e) => e.type === 'trackName' && e.text);
  const raw = named ? named.text.trim() : '';
  const safe = raw.replace(/[^\p{L}\p{N} _.-]/gu, '').trim();
  const num = String(index + 1).padStart(2, '0');
  return safe ? `${num}-${safe}` : `pista-${num}`;
}

// Convierte una lista de eventos con deltaTime en [{ absTime, event }] ordenable.
function toAbsolute(events) {
  let t = 0;
  return events.map((event) => {
    t += event.deltaTime;
    return { absTime: t, event };
  });
}

// Reconstruye deltaTime a partir de tiempos absolutos ya ordenados.
function toDelta(items) {
  let prev = 0;
  return items.map(({ absTime, event }) => {
    const out = { ...event, deltaTime: absTime - prev };
    prev = absTime;
    return out;
  });
}

// Extrae los eventos globales (tempo, compás...) de TODAS las pistas.
function buildConductorTrack(tracks) {
  const collected = [];
  for (const events of tracks) {
    for (const { absTime, event } of toAbsolute(events)) {
      if (event.meta && GLOBAL_META.has(event.type)) {
        collected.push({ absTime, event: { ...event } });
      }
    }
  }
  collected.sort((a, b) => a.absTime - b.absTime || 0);
  const out = toDelta(collected);
  out.push({ deltaTime: 0, meta: true, type: 'endOfTrack' });
  return out;
}

/**
 * Divide un MIDI en una pista por cada pista con notas.
 * @param {Uint8Array|ArrayBuffer|Buffer} input  bytes del archivo .mid
 * @param {object} [opts]
 * @param {boolean} [opts.includeEmpty=false] incluir también pistas sin notas
 * @returns {{ name: string, index: number, notes: number, data: Uint8Array }[]}
 */
export function splitMidi(input, opts = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const parsed = parseMidi(bytes);
  const division = parsed.header.ticksPerBeat || 480;
  const conductor = buildConductorTrack(parsed.tracks);

  const results = [];
  parsed.tracks.forEach((events, index) => {
    const hasNotes = isNoteTrack(events);
    if (!hasNotes && !opts.includeEmpty) return;

    const noteCount = events.filter(
      (e) => e.type === 'noteOn' && e.velocity > 0
    ).length;

    // Nos aseguramos de que la pista termine con endOfTrack.
    const body = events.filter((e) => e.type !== 'endOfTrack');
    body.push({ deltaTime: 0, meta: true, type: 'endOfTrack' });

    const midi = {
      header: {
        format: 1,
        numTracks: 2,
        ticksPerBeat: division,
      },
      tracks: [conductor.map((e) => ({ ...e })), body],
    };

    results.push({
      name: trackName(events, index),
      index,
      notes: noteCount,
      data: new Uint8Array(writeMidi(midi)),
    });
  });

  return results;
}

// Limpia un nombre para poder usarlo como nombre de archivo.
export function sanitizeName(raw, fallback = 'pista') {
  const safe = String(raw == null ? '' : raw)
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/[/\\]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim();
  return safe || fallback;
}

// Devuelve una copia del .mid con el nombre de la pista (evento meta trackName)
// puesto a `name`, para que un DAW muestre ese nombre al abrir el archivo.
export function renameTrack(input, name) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const parsed = parseMidi(bytes);

  let target = parsed.tracks.findIndex((events) => isNoteTrack(events));
  if (target === -1) target = parsed.tracks.length - 1;

  parsed.tracks[target] = withTrackName(parsed.tracks[target], name);
  return new Uint8Array(writeMidi(parsed));
}

// Copia con nombre de pista puesto a `name`, sobre una lista de eventos.
function withTrackName(events, name) {
  const kept = toAbsolute(events).filter(({ event }) => event.type !== 'trackName');
  return [
    { deltaTime: 0, meta: true, type: 'trackName', text: name },
    ...toDelta(kept),
  ];
}

/**
 * Reconstruye un único .mid a partir del original aplicando cambios de la web:
 * quita las pistas silenciadas y renombra el resto.
 * @param {Uint8Array|ArrayBuffer} input  bytes del .mid original
 * @param {{ index: number, name: string, muted: boolean }[]} tracks
 *        una entrada por cada pista con notas (index = posición en el original)
 * @returns {Uint8Array}
 */
export function mergeMidi(input, tracks) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const parsed = parseMidi(bytes);
  const managed = new Map(tracks.map((t) => [t.index, t]));

  const out = [];
  parsed.tracks.forEach((events, idx) => {
    const cfg = managed.get(idx);
    if (!cfg) {
      out.push(events); // pista de meta/tempo: se conserva intacta
    } else if (!cfg.muted) {
      out.push(withTrackName(events, cfg.name));
    }
  });

  if (out.length === 0) {
    out.push([{ deltaTime: 0, meta: true, type: 'endOfTrack' }]);
  }

  const header = {
    ...parsed.header,
    numTracks: out.length,
    format: out.length > 1 ? 1 : parsed.header.format || 0,
  };
  return new Uint8Array(writeMidi({ header, tracks: out }));
}

export { parseMidi, writeMidi };
