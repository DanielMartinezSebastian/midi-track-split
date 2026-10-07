import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import RetroCanvas from 'trama-ui/RetroCanvas';
import * as engine from './engine.js';

const MAX_RINGS = 8;
const CORE = 0.55;
// puntos de la onda alrededor de cada anillo (y segmentos de su geometría)
const SEG = 256;

// Aspectos del filtro de RetroCanvas, todos monocromos. La canción los recorre en orden: cada etapa
// (engine.getStage, marcada por las entradas de las pistas) pasa al siguiente, y `shift` (un toque en el
// título del archivo) los adelanta a mano. El primero es el de reposo.
const LOOKS = [
  { ramp: 'dots', cellSize: 3, cellAspect: 1 },
  { ramp: 'braille', cellSize: 6, cellAspect: 1.4 },
  { ramp: 'binary', cellSize: 9, cellAspect: 1.4 },
];
// al cambiar de aspecto, un golpe breve de glitch en vez de un fundido
const BURST = { glitch: 0.7, aberration: 0.6 };
const BURST_MS = 320;
// `?look=N` en la URL fija un aspecto para verlo o ajustarlo sin esperar a su etapa
const FIXED_LOOK = Number(new URLSearchParams(location.search).get('look') ?? NaN);

/**
 * Fondo fijo: un solo lienzo donde cada pista es una pieza. La batería es el núcleo y cada una de las demás pistas un
 * anillo, de dentro afuera en su orden. Solo se dibujan las pistas activas: silenciar una pista (o dejarla fuera de un
 * solo) retira su pieza. Cada anillo es la forma de onda real de su pista, enrollada en círculo, como un osciloscopio;
 * el núcleo crece con el volumen de la batería. El brillo de cada pieza sigue las notas de su pista.
 * `onTap`, si se pasa, convierte el lienzo en un botón (a pantalla completa, un toque cambia de aspecto).
 * `kinds` describe las pistas: una letra por pista, «d» batería y «s» el resto. Sin archivo, tres anillos en reposo.
 */
const Stage = memo(function Stage({ kinds, shift = 0, onTap }) {
  const [stage, setStage] = useState(0);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setStage(engine.getStage()), 120);
    return () => clearInterval(id);
  }, []);
  const index = (Number.isInteger(FIXED_LOOK) ? FIXED_LOOK : stage + shift) % LOOKS.length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setBurst(true);
    const id = setTimeout(() => setBurst(false), BURST_MS);
    return () => clearTimeout(id);
  }, [index]);

  return (
    <div className="mts__bg" data-look={index} aria-hidden onClick={onTap} style={onTap ? { cursor: 'pointer' } : undefined}>
      <RetroCanvas tint="scene" dither={0.65} contrast={1.5} invert scanlines={0.6} scanlineSize={1} scanlineRoll={0.65} vignette={0} flicker={0} glitch={0.05} cameraZ={9} pointerFx="parallax" pointerStrength={0.7} interaction="window" {...(LOOKS[index] ?? LOOKS[0])} {...(burst ? BURST : null)}>
        <TrackShapes kinds={kinds} />
      </RetroCanvas>
    </div>
  );
});
export default Stage;

// acerca `from` a `to` con una velocidad al subir y otra al bajar (seguidor de envolvente)
const follow = (from, to, dt, up, down) => from + (to - from) * Math.min(1, dt * (to > from ? up : down));

/**
 * Convierte el búfer de audio de una pista en la onda que dibuja su anillo: `shape`, SEG puntos que dan la vuelta.
 * Como un osciloscopio: la ventana arranca en un cruce por cero ascendente (la onda no baila de un fotograma a otro) y
 * abarca tres periodos de la nota que suena, así se ve la forma de la onda tanto en un bajo como en una flauta.
 * Los dos extremos se funden para que el anillo cierre sin escalón; la traza se suaviza a lo largo del anillo (media de
 * sus vecinos) y en el tiempo (cada punto se acerca despacio al nuevo valor), para que ondule en vez de saltar.
 * Devuelve el pico de la señal en la ventana (sin suavizar): el volumen real en ese instante.
 */
const CYCLES = 3; // periodos de la nota que dan la vuelta al anillo
const SMOOTH = 9; // vecinos a cada lado en la media: deja la onda principal y quita el rizado de los armónicos
const trace = new Float32Array(SEG);
function traceWave(buf, shape, hz, dt) {
  const period = engine.sampleRate() / hz;
  const span = Math.max(24, Math.min(Math.round(period * CYCLES), buf.length - 2));
  let start = 0;
  for (let n = 1; n < buf.length - span - 1; n++) {
    if (buf[n - 1] <= 0 && buf[n] > 0) {
      start = n;
      break;
    }
  }
  const ease = Math.min(1, dt * 4.5);
  const fade = SEG / 8;
  let peak = 0;
  for (let k = 0; k < SEG; k++) {
    const at = start + (k / SEG) * span;
    const n = Math.floor(at);
    let v = buf[n] + (buf[n + 1] - buf[n]) * (at - n);
    // cierre del anillo: el final de la ventana se funde con lo que hay justo antes de su inicio
    if (k > SEG - fade) {
      const t = (k - (SEG - fade)) / fade;
      const before = buf[Math.max(0, Math.round(start - (SEG - k) * (span / SEG)))];
      v += (before - v) * t;
    }
    trace[k] = v;
    const m = Math.abs(v);
    if (m > peak) peak = m;
  }
  for (let k = 0; k < SEG; k++) {
    let v = 0;
    for (let j = -SMOOTH; j <= SMOOTH; j++) v += trace[(k + j + SEG) % SEG];
    v /= SMOOTH * 2 + 1;
    shape[k] += (v - shape[k]) * ease;
  }
  return peak;
}

// Da al anillo la forma de la onda: cada punto de `shape` empuja su tramo hacia fuera o hacia dentro, y en profundidad.
// La geometría original y la posición de cada vértice a lo largo del anillo se guardan la primera vez.
function shapeRing(mesh, shape, gain) {
  const pos = mesh.geometry.attributes.position;
  let d = mesh.userData.wave;
  if (!d) {
    const base = pos.array.slice();
    const along = new Float32Array(pos.count);
    for (let v = 0; v < pos.count; v++) along[v] = ((Math.atan2(base[v * 3 + 1], base[v * 3]) / (2 * Math.PI) + 1) % 1) * SEG;
    d = mesh.userData.wave = { base, along, flat: true };
  }
  if (gain < 0.0005) {
    if (!d.flat) {
      pos.array.set(d.base);
      pos.needsUpdate = true;
      d.flat = true;
    }
    return;
  }
  const { base, along } = d;
  const out = pos.array;
  for (let v = 0; v < pos.count; v++) {
    const k = Math.floor(along[v]);
    const f = along[v] - k;
    const w = (shape[k % SEG] * (1 - f) + shape[(k + 1) % SEG] * f) * gain;
    const x = base[v * 3];
    const y = base[v * 3 + 1];
    const push = 1 + w / Math.hypot(x, y);
    out[v * 3] = x * push;
    out[v * 3 + 1] = y * push;
    out[v * 3 + 2] = base[v * 3 + 2] + w * 0.6;
  }
  pos.needsUpdate = true;
  d.flat = false;
}

function TrackShapes({ kinds }) {
  // pieza de cada pista: 0 = núcleo (batería), 1…n = anillos; con más de MAX_RINGS pistas, se reparten
  const { slots, rings, core } = useMemo(() => {
    if (!kinds) return { slots: [], rings: 3, core: false };
    const melodic = [...kinds].filter((k) => k !== 'd').length;
    let next = 0;
    const slots = [...kinds].map((k) => (k === 'd' ? 0 : 1 + (next++ % MAX_RINGS)));
    return { slots, rings: Math.min(melodic, MAX_RINGS), core: kinds.includes('d') };
  }, [kinds]);
  // con tres anillos, los radios de la figura «rings» de Trama (1.0, 1.6, 2.2); con más, se reparten hasta 2.6
  const radii = useMemo(() => {
    if (rings === 1) return [1.6];
    const span = rings <= 3 ? 0.6 * (rings - 1) : 1.6;
    return Array.from({ length: rings }, (_, i) => 1 + (i * span) / (rings - 1));
  }, [rings]);
  // cuantas más pistas, más finos los anillos: caben todos sin empastarse
  const tube = Math.max(0.035, Math.min(0.1, 0.3 / Math.max(rings, 1)));
  const pieces = rings + 1;

  const group = useRef(null);
  const meshes = useRef([]);
  // estado de la animación, fuera de React: se actualiza en cada fotograma
  const anim = useRef(null);
  if (!anim.current) {
    anim.current = {
      angle: 0,
      time: 0,
      zoom: 1,
      mix: 0,
      energy: 0,
      buf: new Float32Array(engine.WAVE_SIZE),
      shapes: Array.from({ length: MAX_RINGS + 1 }, () => new Float32Array(SEG)),
      peak: [], // brillo: sigue las notas de la pista
      loud: [], // volumen real de la pieza, suavizado
      vis: [], // entra y sale al activar o silenciar
      hz: [], // nota que domina en cada anillo; se mantiene entre notas
      amp: [], // cuánto se abre la onda: 0 en los silencios, 1 con la pista sonando
      hold: [], // volumen de referencia de la pista: sube con los picos y baja muy despacio
    };
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const a = anim.current;
    const pulse = engine.getPulse();
    const idle = slots.length === 0; // sin archivo: los anillos de reposo, todos visibles

    let energy = 0;
    let shownCount = 0;
    for (let s = 0; s < pieces; s++) {
      // de las pistas de esta pieza que se oyen, manda la que más suena ahora
      let track = -1;
      let target = 0;
      let shown = idle && s > 0;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] !== s || !pulse.heard[i]) continue;
        shown = true;
        if (track < 0 || pulse.levels[i] > target) {
          track = i;
          target = pulse.levels[i];
        }
      }
      a.peak[s] = follow(a.peak[s] || 0, target, dt, 12, 3);
      a.vis[s] = follow(a.vis[s] ?? (shown ? 1 : 0), shown ? 1 : 0, dt, 5, 5);
      if (track >= 0 && pulse.pitch[track]) {
        const hz = engine.pitchToHz(pulse.pitch[track]);
        a.hz[s] = a.hz[s] ? a.hz[s] * (hz / a.hz[s]) ** Math.min(1, dt * 3) : hz;
      }

      // la onda real de la pista: la forma del anillo o, en el núcleo, su volumen
      let wavePeak = 0;
      const shape = a.shapes[s];
      if (track >= 0) {
        engine.readWave(track, a.buf);
        wavePeak = traceWave(a.buf, shape, s === 0 ? 110 : a.hz[s] || 220, dt);
      } else {
        for (let k = 0; k < SEG; k++) shape[k] *= 0.93;
      }
      a.loud[s] = follow(a.loud[s] || 0, wavePeak, dt, 2, 0.6);
      // puerta: la onda solo se abre si la pista tiene una nota en curso y hay señal de verdad; en los silencios
      // (colas de las muestras, ruido de fondo) el anillo vuelve a su círculo en vez de amplificar lo poco que queda
      const open = Math.min(1, target * 4) * Math.min(1, Math.max(0, (wavePeak - 0.015) / 0.05));
      a.amp[s] = follow(a.amp[s] || 0, open, dt, 4, 2);
      // la altura de la onda se mide contra el pico reciente de la pista, que casi no baja en un silencio breve:
      // así un pasaje flojo se ve flojo y el silencio no se infla
      a.hold[s] = Math.max(wavePeak, (a.hold[s] || 0) - dt * 0.04);
      if (shown) {
        energy += a.loud[s];
        shownCount++;
      }
    }
    a.energy = follow(a.energy, shownCount ? energy / shownCount : 0, dt, 2, 1);
    a.mix = follow(a.mix, pulse.playing ? 1 : 0, dt, 3, 2);

    // giro lento; la música lo anima apenas
    a.angle += dt * (0.16 + Math.min(a.energy, 0.5) * 0.3);
    // zoom: al reproducir la figura se acerca y, cada cierto tiempo, crece hasta llenar la pantalla como un fondo
    a.time += dt;
    const zoom = pulse.playing ? 1.75 + 0.75 * Math.sin(a.time * 0.11) : 1.15;
    a.zoom = follow(a.zoom, zoom, dt, 0.5, 0.5);
    if (group.current) {
      group.current.scale.setScalar(a.zoom);
      group.current.rotation.y = a.angle * 0.5;
      group.current.rotation.x = a.angle * 0.3;
    }
    for (let s = 0; s < pieces; s++) {
      const m = meshes.current[s];
      if (!m) continue;
      m.visible = a.vis[s] > 0.01;
      const vis = Math.max(a.vis[s], 0.001);
      // brillo: en reposo, blanco; sonando, casi a oscuras y las notas de la pista lo llevan por encima
      // del blanco (el material admite más de 1 y la luz lo quema)
      const lit = 0.08 + Math.pow(a.peak[s], 0.8) * 2.4;
      m.material.color.setScalar(1 + (lit - 1) * a.mix);
      if (s === 0) {
        // núcleo: crece con el volumen real de la batería
        m.scale.setScalar(vis * (1 + Math.min(a.loud[0], 0.6) * 1.2));
        m.rotation.y = -a.angle;
        continue;
      }
      m.scale.setScalar(vis);
      // anillo: su contorno es la onda, con la puerta y la referencia de volumen de arriba
      if (m.visible) shapeRing(m, a.shapes[s], (a.amp[s] * 0.26) / Math.max(a.hold[s], 0.2));
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={2.6} />
      <directionalLight position={[-4, -2, 2]} intensity={0.6} />
      <group ref={group}>
        <mesh ref={(el) => { meshes.current[0] = el; }} visible={core}>
          <icosahedronGeometry args={[CORE, 0]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.05} flatShading />
        </mesh>
        {radii.map((r, i) => (
          <mesh key={`${rings}-${i}`} ref={(el) => { meshes.current[i + 1] = el; }} rotation={[i * 1.05, i * 0.7, i * 0.4]}>
            <torusGeometry args={[r, tube, 8, SEG]} />
            <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.1} />
          </mesh>
        ))}
      </group>
    </>
  );
}
