// Escenas alternativas del fondo (ui/Stage.jsx las monta dentro del mismo RetroCanvas). Como los anillos,
// salen del sonido real de cada pista (engine.readBands) o de sus notas (engine.trackNotes), solo cuentan
// las pistas activas y tienen un estado de reposo para cuando no hay archivo o no suena nada.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Color, DoubleSide, Object3D } from 'three';
import * as engine from './engine.js';

const BANDS = engine.BANDS;
// acerca `from` a `to` con una velocidad al subir y otra al bajar (seguidor de envolvente)
const follow = (from, to, dt, up, down) => from + (to - from) * Math.min(1, dt * (to > from ? up : down));

const Lights = () => (
  <>
    <ambientLight intensity={0.25} />
    <directionalLight position={[3, 4, 5]} intensity={2.6} />
    <directionalLight position={[-4, -2, 2]} intensity={0.6} />
  </>
);

// pistas que se oyen ahora (índices), como mucho `max`
function heardTracks(pulse, max, out) {
  out.length = 0;
  for (let i = 0; i < pulse.heard.length && out.length < max; i++) if (pulse.heard[i]) out.push(i);
  return out;
}

// ---------- Espectro: un aro de barras por pista, graves al frente y agudos detrás ----------

const ROWS = 6;
const BARS = BANDS * 2; // cada aro es el espectro y su reflejo: queda simétrico

export function Spectrum() {
  const group = useRef(null);
  const mesh = useRef(null);
  const st = useRef(null);
  if (!st.current) {
    st.current = { vals: new Float32Array(ROWS * BANDS), bands: new Float32Array(BANDS), tracks: [], time: 0, mix: 0, dummy: new Object3D(), color: new Color() };
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const m = mesh.current;
    if (!m) return;
    const pulse = engine.getPulse();
    const tracks = heardTracks(pulse, ROWS, s.tracks);
    const idle = pulse.heard.length === 0; // sin archivo: un aro que respira
    const rows = idle ? 1 : tracks.length;
    s.time += dt;
    s.mix = follow(s.mix, pulse.playing ? 1 : 0, dt, 3, 2);

    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      const on = r < rows;
      if (on && !idle) engine.readBands(tracks[r], s.bands);
      const radius = 1.15 + r * 0.42;
      for (let b = 0; b < BANDS; b++) {
        const target = !on ? 0 : idle ? 0.1 + 0.08 * Math.sin(b * 0.5 + s.time * 1.2) : s.bands[b];
        const v = (s.vals[r * BANDS + b] = follow(s.vals[r * BANDS + b], target, dt, 14, 2.2));
        const h = on ? 0.05 + v * 1.7 : 0.0001;
        // en reposo, blanco; sonando, cada barra brilla según su altura
        const lit = 1 + (0.12 + v * 1.1 - 1) * s.mix;
        for (let side = 0; side < 2; side++) {
          const angle = ((b + 0.5) / BARS) * Math.PI * 2 * (side ? -1 : 1) + Math.PI / 2;
          s.dummy.position.set(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
          s.dummy.rotation.set(0, -angle, 0);
          s.dummy.scale.set(0.1, h, (Math.PI * 2 * radius) / BARS * 0.62);
          s.dummy.updateMatrix();
          m.setMatrixAt(n, s.dummy.matrix);
          m.setColorAt(n, s.color.setScalar(lit));
          n++;
        }
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (group.current) group.current.rotation.y += dt * 0.1;
  });

  return (
    <>
      <Lights />
      <group rotation={[0.72, 0, 0]} position={[0, -0.5, 0]} scale={1.25}>
        <group ref={group}>
          <instancedMesh ref={mesh} args={[null, null, ROWS * BARS]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.1} />
          </instancedMesh>
        </group>
      </group>
    </>
  );
}

// ---------- Terreno: el espectro de la mezcla avanza hacia el fondo y deja un relieve ----------

const TW = BANDS * 2; // graves en el centro, agudos hacia los lados
const TD = 44; // filas de historia
const STEP = 0.055; // segundos entre filas

export function Terrain() {
  const mesh = useRef(null);
  const st = useRef(null);
  if (!st.current) {
    st.current = { heights: new Float32Array(TW * TD), row: new Float32Array(BANDS), bands: new Float32Array(BANDS), tracks: [], acc: 0, time: 0, mix: 0 };
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const m = mesh.current;
    if (!m) return;
    const pulse = engine.getPulse();
    const tracks = heardTracks(pulse, 16, s.tracks);
    s.time += dt;
    s.mix = follow(s.mix, pulse.playing ? 1 : 0, dt, 3, 2);

    // la fila nueva: lo más alto de cada banda entre las pistas que se oyen
    s.row.fill(0);
    if (pulse.playing) {
      for (const i of tracks) {
        engine.readBands(i, s.bands);
        for (let b = 0; b < BANDS; b++) if (s.bands[b] > s.row[b]) s.row[b] = s.bands[b];
      }
    } else {
      // en reposo, un oleaje suave
      for (let b = 0; b < BANDS; b++) s.row[b] = 0.3 + 0.22 * Math.sin(b * 0.35 + s.time * 0.9) * Math.cos(s.time * 0.4);
    }

    s.acc += dt;
    while (s.acc >= STEP) {
      s.acc -= STEP;
      // todo se aleja una fila (la 0 es la del fondo) y la nueva entra por delante
      s.heights.copyWithin(0, TW);
      const base = TW * (TD - 1);
      for (let x = 0; x < TW; x++) {
        const b = Math.min(BANDS - 1, Math.abs(x - (TW - 1) / 2) | 0);
        s.heights[base + x] = s.row[b];
      }
    }

    const geo = m.geometry;
    if (!geo.attributes.color) geo.setAttribute('color', new BufferAttribute(new Float32Array(TW * TD * 3), 3));
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    for (let k = 0; k < TW * TD; k++) {
      // las filas más cercanas se aplanan: si no, el frente es un muro que tapa el resto
      const near = Math.min(1, (TD - 1 - ((k / TW) | 0)) / 7);
      const h = s.heights[k] * near;
      pos.array[k * 3 + 2] = h * 1.7;
      // el filtro del lienzo va invertido para este material sin luces: cuanto más oscuro el color,
      // más denso el trazo. Así las crestas salen llenas y los valles, casi vacíos
      const tone = 0.62 - Math.min(0.58, h * 0.95);
      col.array[k * 3] = col.array[k * 3 + 1] = col.array[k * 3 + 2] = tone;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    m.rotation.z = Math.sin(s.time * 0.12) * 0.12;
  });

  return (
    <>
      <Lights />
      <group rotation={[-1.12, 0, 0]} position={[0, -2.1, 0]}>
        <mesh ref={mesh} frustumCulled={false}>
          <planeGeometry args={[14, 12, TW - 1, TD - 1]} />
          {/* sin luces: el brillo de cada punto es exactamente su altura */}
          <meshBasicMaterial vertexColors side={DoubleSide} />
        </mesh>
      </group>
    </>
  );
}

// ---------- Notas: las notas del MIDI vienen de frente por pista, como una autopista ----------

const MAX_NOTES = 360;
const NOW = 2.5; // dónde queda la línea de «ahora», hacia la cámara
const AHEAD = 5; // segundos que se ven por delante
const SPEED = 1.9; // unidades por segundo
// sin archivo, un patrón de muestra en bucle para que la escena no esté vacía
const DEMO_LEN = 4;
const DEMO = [0, 4, 7, 12, 7, 4, 0, 7].flatMap((semi, k) => [
  { time: k * 0.5, duration: 0.42, midi: 60 + semi },
  ...(k % 4 === 0 ? [{ time: k * 0.5, duration: 1.8, midi: 36 + (k ? 5 : 0) }] : []),
]);

export function Notes() {
  const mesh = useRef(null);
  const st = useRef(null);
  if (!st.current) st.current = { tracks: [], time: 0, mix: 0, dummy: new Object3D(), color: new Color() };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const m = mesh.current;
    if (!m) return;
    const pulse = engine.getPulse();
    const tracks = heardTracks(pulse, 8, s.tracks);
    const idle = pulse.heard.length === 0;
    s.time += dt;

    let n = 0;
    const put = (note, cur, lane, lanes) => {
      const from = (note.time - cur) * SPEED;
      const len = Math.max(0.1, note.duration * SPEED);
      const sounding = note.time <= cur && cur < note.time + note.duration;
      // tono a lo ancho (cinco octavas), pista en altura
      const x = Math.max(-4, Math.min(4, ((note.midi - 60) / 30) * 3.6));
      const y = (lane - (lanes - 1) / 2) * 0.42;
      s.dummy.position.set(x, y, NOW - (from + len / 2));
      s.dummy.rotation.set(0, 0, 0);
      s.dummy.scale.set(sounding ? 0.26 : 0.16, sounding ? 0.22 : 0.1, len);
      s.dummy.updateMatrix();
      m.setMatrixAt(n, s.dummy.matrix);
      // lo que suena, quemado; lo que viene, más tenue cuanto más lejos
      m.setColorAt(n, s.color.setScalar(sounding ? 1.3 : 0.2 + 0.5 * (1 - Math.min(1, from / (AHEAD * SPEED)))));
      n++;
    };

    if (idle) {
      const cur = s.time % DEMO_LEN;
      for (let loop = 0; loop < 2; loop++) for (const note of DEMO) put({ ...note, time: note.time + loop * DEMO_LEN }, cur, 0, 1);
    } else {
      const cur = engine.playhead();
      tracks.forEach((i, lane) => {
        const notes = engine.trackNotes(i);
        // primera nota que aún no ha terminado de pasar (las notas vienen ordenadas por tiempo)
        let lo = 0;
        let hi = notes.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (notes[mid].time < cur - 2) lo = mid + 1; else hi = mid;
        }
        for (let k = lo; k < notes.length && n < MAX_NOTES; k++) {
          const note = notes[k];
          if (note.time > cur + AHEAD) break;
          if (note.time + note.duration < cur - 0.15) continue;
          put(note, cur, lane, tracks.length);
        }
      });
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <Lights />
      <group rotation={[0.52, 0, 0]} position={[0, -1.3, 0]}>
        <instancedMesh ref={mesh} args={[null, null, MAX_NOTES]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.1} />
        </instancedMesh>
        {/* la línea de «ahora»: las notas la cruzan al sonar */}
        <mesh position={[0, -0.3, NOW]}>
          <boxGeometry args={[9, 0.03, 0.05]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
    </>
  );
}
