// Genera un MIDI de ejemplo con 4 pistas: melodía (flauta), bajo (bajo eléctrico),
// acordes (piano eléctrico) y batería (canal 10).
import { writeFileSync } from 'node:fs';
import { writeMidi } from 'midi-file';

const TPB = 480;

function track(name, channel, program, notes) {
  // notes: [ [pitch, startBeat, lenBeats, vel] ]
  const evs = [{ deltaTime: 0, meta: true, type: 'trackName', text: name }];
  if (program != null) {
    evs.push({ deltaTime: 0, type: 'programChange', channel, programNumber: program });
  }
  const flat = [];
  for (const [p, start, len, vel] of notes) {
    flat.push({ t: Math.round(start * TPB), type: 'noteOn', channel, noteNumber: p, velocity: vel });
    flat.push({ t: Math.round((start + len) * TPB), type: 'noteOff', channel, noteNumber: p, velocity: 0 });
  }
  flat.sort((a, b) => a.t - b.t);
  let prev = 0;
  for (const e of flat) {
    evs.push({ deltaTime: e.t - prev, type: e.type, channel: e.channel, noteNumber: e.noteNumber, velocity: e.velocity });
    prev = e.t;
  }
  evs.push({ deltaTime: 0, meta: true, type: 'endOfTrack' });
  return evs;
}

const conductor = [
  { deltaTime: 0, meta: true, type: 'trackName', text: 'Conductor' },
  { deltaTime: 0, meta: true, type: 'setTempo', microsecondsPerBeat: 500000 },
  { deltaTime: 0, meta: true, type: 'timeSignature', numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 },
  { deltaTime: 0, meta: true, type: 'endOfTrack' },
];

const BARS = 5; // repeticiones del patrón de 8 tiempos -> ~20 s

// Repite el patrón de 8 tiempos, empezando en el compás `startBar`.
function loop(pattern, startBar = 0, bars = BARS - startBar) {
  const out = [];
  for (let r = 0; r < bars; r++) {
    for (const [p, s, l, v] of pattern) out.push([p, s + (startBar + r) * 8, l, v]);
  }
  return out;
}

// Cada pista entra en un momento distinto para poder probar "localizar pista":
// acordes desde el principio, batería en el compás 1, bajo en el 2, melodía en el 3.
const chords = track('Acordes', 2, 4, loop([ // 4 = electric piano 1
  [60, 0, 2, 70], [64, 0, 2, 70], [67, 0, 2, 70],
  [59, 2, 2, 70], [62, 2, 2, 70], [67, 2, 2, 70],
  [57, 4, 2, 70], [60, 4, 2, 70], [64, 4, 2, 70],
  [55, 6, 2, 70], [59, 6, 2, 70], [62, 6, 2, 70],
], 0));

// Canal 10 (índice 9) = percusión. 36 bombo, 38 caja, 42 charles cerrado.
const drumPattern = [];
for (let b = 0; b < 8; b++) {
  drumPattern.push([36, b, 0.1, 110]);            // bombo a negras
  if (b % 2 === 1) drumPattern.push([38, b, 0.1, 100]); // caja en 2 y 4
  drumPattern.push([42, b, 0.1, 80]);             // charles
  drumPattern.push([42, b + 0.5, 0.1, 70]);
}
const drums = track('Bateria', 9, null, loop(drumPattern, 1));

const bass = track('Bajo', 1, 33, loop([ // 33 = electric bass (finger)
  [36, 0, 1, 100], [36, 1, 1, 90], [31, 2, 1, 100], [31, 3, 1, 90],
  [33, 4, 1, 100], [33, 5, 1, 90], [31, 6, 1, 100], [31, 7, 1, 90],
], 2));

const melody = track('Melodia', 0, 73, loop([ // 73 = flute
  [72, 0, 0.5, 95], [74, 0.5, 0.5, 95], [76, 1, 0.5, 95], [77, 1.5, 0.5, 95],
  [79, 2, 1, 105], [76, 3, 1, 90],
  [72, 4, 0.5, 95], [74, 4.5, 0.5, 95], [76, 5, 0.5, 95], [77, 5.5, 0.5, 95],
  [79, 6, 2, 105],
], 3));

const midi = {
  header: { format: 1, numTracks: 5, ticksPerBeat: TPB },
  tracks: [conductor, chords, drums, bass, melody],
};

writeFileSync(new URL('../sample/demo.mid', import.meta.url), Buffer.from(writeMidi(midi)));
console.log('sample/demo.mid creado (acordes, batería, bajo, melodía con entradas escalonadas)');
