import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import Button from 'trama-ui/Button';
import Footer from 'trama-ui/Footer';
import Marquee from 'trama-ui/Marquee';
import NavBar from 'trama-ui/NavBar';
import Select from 'trama-ui/Select';
import Toast from 'trama-ui/Toast';
import Tooltip from 'trama-ui/Tooltip';
import { tokensToStyle } from 'trama-ui/tokens';
import * as engine from './engine.js';
import Stage from './Stage.jsx';

// Tema: el de la landing SILO de Trama. Negro, blanco y un solo gris; sin
// superficies ni radios. El único ornamento es el fondo (RetroCanvas).
const TOKENS = tokensToStyle({
  bg: '#000000',
  fg: '#f2f2f2',
  mut: '#7a7a7a',
  acc: '#ffffff',
  acc2: '#7a7a7a',
  card: 'transparent',
  ln: 'rgba(255,255,255,0.14)',
  r: 0,
  font: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  display: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
});

const TOAST_ID = 'mts-toast';
// `?bare` en la URL deja solo el fondo, sin interfaz
const BARE = new URLSearchParams(location.search).has('bare');
const NO_DEVICE = '— ninguno —';
const CHANNELS = Array.from({ length: 16 }, (_, i) => ({ id: String(i + 1), label: `Canal ${i + 1}` }));

const useEngine = () => useSyncExternalStore(engine.subscribe, engine.getState);
const useClock = () => useSyncExternalStore(engine.subscribeClock, engine.getClock);

export default function App() {
  const s = useEngine();
  const fileInput = useRef(null);
  const dragging = useFileDrop(engine.loadFile);
  // toques en el título del archivo: cada uno pasa al siguiente aspecto del fondo
  const [lookShift, setLookShift] = useState(0);
  const nextLook = useCallback(() => setLookShift((n) => n + 1), []);
  // Pantalla completa (botón de la cabecera): esconde la interfaz y deja solo el fondo, con la cabecera y el
  // transporte. Donde el navegador lo permite, además pone la página a pantalla completa de verdad
  // (en iPhone no existe esa API: allí solo se oculta la interfaz).
  const [visual, setVisual] = useState(false);
  const toggleVisual = () => {
    const on = !visual;
    setVisual(on);
    try {
      if (on) document.documentElement.requestFullscreen?.()?.catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {});
    } catch {}
  };
  // salir con Esc (o con el gesto del sistema) también devuelve la interfaz
  useEffect(() => {
    const sync = () => !document.fullscreenElement && setVisual(false);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    if (s.error) toast(s.error.message, { toasterId: TOAST_ID, duration: 8000 });
  }, [s.error]);

  const pickFile = () => fileInput.current?.click();
  const go = (item) => {
    // sin archivo, el menú solo ofrece cargar uno
    if (item.href === '#cargar') return pickFile();
    if (item.href?.startsWith('#')) document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  };

  const stem = s.fileName.replace(/\.(mid|midi)$/i, '');
  const title = s.loaded ? stem : 'SPLIT';

  return (
    <div className={`mts ${s.loaded ? 'mts--loaded' : ''} ${s.playing ? 'mts--playing' : ''} ${visual ? 'mts--visual' : ''} ${BARE ? 'mts--bare' : ''}`} style={TOKENS}>
      <Stage kinds={s.tracks.map((t) => (t.drum ? 'd' : 's')).join('')} shift={lookShift} onTap={visual ? nextLook : undefined} />
      <Toast id={TOAST_ID} position="top-center" variant="minimal" intentStyle="mono" icons="none" showTrigger={false} />
      <input
        ref={fileInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) engine.loadFile(e.target.files[0]);
          e.target.value = '';
        }}
      />

      <header className="mts__nav">
        <NavBar
          brand="MIDI TRACK SPLIT"
          links={visual ? '' : s.loaded ? 'Pistas=#pistas, Teclado=#teclado, Sonido=#sonido' : 'Cargar archivo MIDI=#cargar'}
          cta=""
          secondaryCta=""
          search="none"
          layout="right"
          shape="transparent"
          size="sm"
          variant="minimal"
          collapseAt={520}
          mobileMenu="sheet"
          onNavigate={go}
          defaultActive={-1}
        />
        <button type="button" className="mts__full" aria-pressed={visual} aria-label={visual ? 'Salir de pantalla completa' : 'Pantalla completa: solo las visuales'} onClick={toggleVisual}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {visual ? <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /> : <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />}
          </svg>
        </button>
      </header>

      <main className="mts__main">
        {/* ---------- portada: el archivo ---------- */}
        <section className="mts__hero">
          <p className="mts__label">{s.loaded ? 'Archivo · toca el nombre para cambiar el fondo' : 'Separador de pistas MIDI'}</p>
          <h1 className="mts__name" style={{ '--len': Math.max(title.length, 4) }}>
            {s.loaded ? (
              <button type="button" className="mts__name-btn" aria-label={`${title}: cambiar el estilo del fondo`} onClick={nextLook}>{title}</button>
            ) : (
              <button type="button" className="mts__name-btn" aria-label="Elegir archivo .mid" onClick={pickFile}>{title}</button>
            )}
          </h1>
          <div className="mts__hero-foot">
            <div className="mts__pick">
              <Button label={s.loaded ? 'Cambiar archivo' : 'Elegir archivo .mid'} glyph="↑" glyphPosition="start" variant="minimal" intent="neutral" size="lg" className={`mts__open ${s.loaded ? 'mts__open--again' : ''}`} onClick={pickFile} />
              <p className="mts__label">o arrástralo a la ventana</p>
            </div>
            <p className="mts__label">
              {s.loaded ? (
                <>
                  <span>{s.tracks.length} {s.tracks.length === 1 ? 'pista' : 'pistas'}</span> · {engine.fmt(s.duration)}
                </>
              ) : (
                'Todo ocurre en tu navegador'
              )}
            </p>
          </div>
        </section>

        {s.loaded && (
          <>
            <div className="mts__strip">
              <Marquee
                text={s.tracks.map((t) => t.name).join(' · ')}
                variant="minimal"
                tone="mut"
                rows={1}
                fontSize={14}
                duration={60}
                separator="     ·     "
              />
            </div>

            {/* ---------- pistas ---------- */}
            <section id="pistas" className="mts__section">
              <div className="mts__head">
                <p className="mts__label">Pistas</p>
                <div className="mts__actions">
                  <Tooltip content={s.canMerge ? 'Un solo .mid sin las pistas silenciadas y con los nombres nuevos' : 'Activa al menos una pista para exportar'} follow={false} variant="minimal" side="bottom">
                    <Button label="MIDI combinado" glyph="↓" variant="minimal" intent="neutral" size="sm" disabled={!s.canMerge} onClick={engine.downloadMerged} />
                  </Tooltip>
                  <Button label="Pistas .zip" glyph="↓" variant="minimal" intent="neutral" emphasis="outline" size="sm" onClick={engine.downloadZip} />
                </div>
              </div>
              <TrackList tracks={s.tracks} extEnabled={s.midi.enabled} flash={s.flash} />
              <p className="mts__hint">
                Clic en el nombre para renombrar · <b>Solo</b> la escucha sola en el PC · <b>Mute</b> la silencia · <b>EXT</b> envía la pista al teclado MIDI · <b>▶</b> reproduce desde su primera nota
              </p>
            </section>

            {/* ---------- teclado MIDI ---------- */}
            <section id="teclado" className="mts__section">
              <p className="mts__label">Teclado MIDI</p>
              <p className="mts__statement">Saca una pista por tu teclado.</p>
              <MidiPanel midi={s.midi} internalMuted={s.internalMuted} externalMuted={s.externalMuted} />
            </section>

            {/* ---------- bancos de sonido ---------- */}
            <section id="sonido" className="mts__section mts__section--last">
              <p className="mts__label">Bancos de sonido</p>
              <p className="mts__statement">Elige con qué suena.</p>
              <div className="mts__fields">
                <Pick label="Batería" items={s.banks.drums} value={s.banks.drum} onChange={engine.setDrumBank} />
                <Pick label="Otros instrumentos" items={s.banks.kits} value={s.banks.kit} onChange={engine.setKitBank} />
              </div>
              <p className="mts__hint">
                Cada pista usa su instrumento General MIDI con muestras reales; la percusión se aproxima con una caja de ritmos.
              </p>
            </section>
          </>
        )}
      </main>

      <div className="mts__footer">
        <Footer brand="MIDI TRACK SPLIT" tagline="" columns="" social="" copyright="MIT · Daniel Martínez Sebastián" variant="minimal" />
        <a className="mts__site" href="https://www.martinezsebastian.com/herramientas/midi-track-split" target="_blank" rel="noopener">martinezsebastian.com ↗</a>
      </div>

      {s.loaded && <Transport s={s} />}
      {dragging && (
        <div className="mts__drop" aria-hidden>
          <p>Suelta el .mid</p>
        </div>
      )}
    </div>
  );
}

// Toda la ventana es zona de carga: devuelve true mientras se arrastra un archivo encima.
function useFileDrop(onFile) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) onFile(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onFile]);
  return dragging;
}

// ---------- pistas ----------

function TrackList({ tracks, extEnabled, flash }) {
  const { active } = useClock();
  return (
    <ol className="mts__tracks">
      {tracks.map((t) => (
        <Track key={t.index} t={t} active={active[t.index] || 0} extEnabled={extEnabled} flashKey={flash?.index === t.index ? flash.key : 0} />
      ))}
    </ol>
  );
}

const Track = memo(function Track({ t, active, extEnabled, flashKey }) {
  const i = t.index;
  const row = useRef(null);
  const [name, setName] = useState(t.name);
  useEffect(() => setName(t.name), [t.name]);
  const commit = () => setName(engine.setTrackName(i, name));

  // ▶ localiza la pista: la trae a la vista y parpadea
  useEffect(() => {
    if (flashKey) row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [flashKey]);

  const cls = [
    'mts__track',
    active === 1 && 'is-on',
    active === 2 && 'is-on is-on-ext',
    t.muted && 'is-muted',
    t.routed && 'is-routed',
    t.dimmed && 'is-dimmed',
  ].filter(Boolean).join(' ');

  return (
    <li ref={row} className={cls}>
      <span key={flashKey} className={`mts__n ${flashKey ? 'is-flash' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
      <input
        className="mts__tname"
        value={name}
        spellCheck={false}
        aria-label={`Nombre de la pista ${i + 1}`}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="mts__meta">
        {[t.label, t.start > 0.05 && `empieza ${engine.fmt(t.start)}`, t.routed && 'al teclado'].filter(Boolean).join(' · ')}
      </span>
      <div className="mts__ctrl">
        <Tip content="Escuchar solo esta pista">
          <Button label="Solo" variant="minimal" intent="neutral" emphasis="outline" size="md" active={t.solo} disabled={t.routed} aria-label="Escuchar solo esta pista" onClick={() => engine.setSolo(i, !t.solo)} />
        </Tip>
        <Tip content={t.muted ? 'Pista silenciada: pulsa para activar' : 'Silenciar pista'}>
          <Button label="Mute" variant="minimal" intent="neutral" emphasis="outline" size="md" active={t.muted} disabled={t.routed} aria-label={t.muted ? 'Activar pista' : 'Silenciar pista'} onClick={() => engine.setMuted(i, !t.muted)} />
        </Tip>
        <Tip content={extEnabled ? 'Enviar solo esta pista al teclado MIDI (deja de sonar en el PC)' : 'Conecta un teclado MIDI para usar EXT'}>
          <Button label="EXT" variant="minimal" intent="neutral" emphasis="outline" size="md" active={t.toExternal} disabled={!extEnabled} aria-label="Enviar solo esta pista al teclado MIDI" onClick={() => engine.setExternal(i, !t.toExternal)} />
        </Tip>
        <Tip content="Reproducir desde el inicio de esta pista">
          <Button label="▶" variant="minimal" intent="neutral" emphasis="outline" size="md" aria-label="Reproducir desde el inicio de esta pista" onClick={() => engine.playFromTrack(i)} />
        </Tip>
        <Tip content="Descargar esta pista">
          <Button label=".mid" glyph="↓" variant="minimal" intent="neutral" emphasis="outline" size="md" aria-label="Descargar esta pista como .mid" onClick={() => engine.downloadTrack(i)} />
        </Tip>
      </div>
    </li>
  );
});

const Tip = ({ content, children }) => (
  <Tooltip content={content} follow={false} variant="minimal" side="top">
    {children}
  </Tooltip>
);

// ---------- desplegables ----------

/** `Select` de Trama trabaja con textos; aquí se traduce a pares { id, label }. */
function Pick({ label, items, value, onChange }) {
  const options = items.map((o) => o.label.replace(/,/g, '\\,')).join(', ');
  const current = items.find((o) => o.id === value)?.label.trim() ?? '';
  return (
    <Select
      label={label}
      options={options}
      value={current}
      placeholder="—"
      size="sm"
      variant="minimal"
      onChange={(text) => onChange(items.find((o) => o.label.trim() === text)?.id ?? '')}
    />
  );
}

// ---------- salida MIDI externa ----------

function midiStatus(midi, externalMuted) {
  if (midi.error) return midi.error;
  if (!midi.connected) return '';
  if (midi.enabled) {
    const name = midi.outputs.find((o) => o.id === midi.deviceId)?.label || 'dispositivo';
    return (
      `Teclado «${name}» · canal ${midi.channel} — ` +
      (midi.routedNames.length
        ? `enviando: ${midi.routedNames.join(', ')}${externalMuted ? ' (silenciado)' : ''}`
        : 'pulsa EXT en una pista para enviarla')
    );
  }
  if (midi.outputs.length > 0) return 'Elige un dispositivo de salida en la lista.';
  if (midi.inputs > 0) {
    return 'Se detectan entradas MIDI pero ninguna salida. Tu aparato parece un controlador (solo envía notas): para oírlo hace falta un dispositivo con generador de sonido, o un puerto virtual tipo loopMIDI hacia un DAW.';
  }
  return 'MIDI activado, pero no se detecta ningún dispositivo. Prueba a: reconectar el aparato, cerrar otras apps que lo estén usando y reiniciar el navegador; luego pulsa «Buscar de nuevo».';
}

function MidiPanel({ midi, internalMuted, externalMuted }) {
  if (!midi.supported) {
    return (
      <>
        <div className="mts__fields">
          <Button label="Teclado MIDI no disponible" variant="minimal" intent="neutral" emphasis="outline" size="sm" disabled />
        </div>
        {midi.secureContext ? (
          <p className="mts__hint">
            Este navegador no soporta Web MIDI. Usa Chrome, Edge u Opera (en Brave, actívalo en <code>brave://settings/content/midi</code>).
          </p>
        ) : (
          <p className="mts__hint">
            Web MIDI solo funciona en conexión segura, y estás entrando por <code>http://</code> + IP. Opciones:<br />
            · en el mismo equipo, abre <code>http://localhost:{location.port}</code>;<br />
            · o arranca el servidor con <code>npm run web:https</code> y entra por <code>https://</code>;<br />
            · o en Chrome añade este origen en <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> y reinícialo.
          </p>
        )}
      </>
    );
  }

  const status = midiStatus(midi, externalMuted);
  return (
    <>
      {midi.connected ? (
        <div className="mts__fields">
          <Pick label="Dispositivo" items={[{ id: '', label: NO_DEVICE }, ...midi.outputs]} value={midi.deviceId} onChange={engine.midiSelect} />
          <Pick label="Canal" items={CHANNELS} value={String(midi.channel)} onChange={(id) => engine.midiSetChannel(+id || 1)} />
          <div className="mts__toggles">
            <Tip content="Silenciar el sonido interno (PC)">
              <Button label={internalMuted ? 'PC off' : 'PC on'} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={internalMuted} aria-label="Silenciar sonido interno (PC)" onClick={() => engine.setInternalMuted(!internalMuted)} />
            </Tip>
            <Tip content="Silenciar la salida al teclado MIDI">
              <Button label={externalMuted ? 'Teclado off' : 'Teclado on'} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={externalMuted} aria-label="Silenciar salida al teclado MIDI" onClick={() => engine.setExternalMuted(!externalMuted)} />
            </Tip>
            <Button label="Buscar de nuevo" variant="minimal" intent="neutral" emphasis="link" size="sm" onClick={engine.midiRescan} />
          </div>
        </div>
      ) : (
        <div className="mts__fields">
          <Button label="Conectar teclado MIDI" variant="minimal" intent="neutral" size="sm" loading={midi.busy} onClick={engine.midiConnect} />
        </div>
      )}
      {status && <p className="mts__hint">{status}</p>}
    </>
  );
}

// ---------- transporte: dock fijo abajo ----------

function Transport({ s }) {
  const { cur } = useClock();
  const bar = useRef(null);
  // mientras se arrastra, la barra enseña la posición del puntero y no la del reloj
  const [drag, setDrag] = useState(null);

  const ratioOf = (e) => {
    const rect = bar.current.getBoundingClientRect();
    if (!rect.width) return 0;
    const r = (e.clientX - rect.left) / rect.width;
    return isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
  };

  const shown = drag === null ? cur : drag * s.duration;
  const pct = s.duration ? (shown / s.duration) * 100 : 0;

  return (
    <div className="mts-dock">
      <div
        ref={bar}
        className={`mts-dock__seek ${drag !== null ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Posición de reproducción"
        aria-valuemin={0}
        aria-valuemax={Math.round(s.duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={engine.fmt(shown)}
        style={{ '--p': `${pct}%` }}
        onPointerDown={(e) => {
          if (!s.duration) return;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          setDrag(ratioOf(e));
        }}
        onPointerMove={(e) => drag !== null && setDrag(ratioOf(e))}
        onPointerUp={(e) => {
          if (drag === null) return;
          engine.seekTo(ratioOf(e) * s.duration);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 1;
          if (e.key === 'ArrowRight') engine.seekBy(step);
          else if (e.key === 'ArrowLeft') engine.seekBy(-step);
          else return;
          e.preventDefault();
        }}
      />
      <div className="mts-dock__row">
        <button type="button" className="mts-dock__play" aria-label={s.playing ? 'Pausa' : 'Reproducir'} onClick={engine.playPause}>
          {s.playing ? <i className="mts-dock__pause" /> : <i className="mts-dock__tri" />}
        </button>
        <Button label="Parar" variant="minimal" intent="neutral" emphasis="ghost" size="sm" onClick={engine.stopPlayback} />
        <Button label="Bucle" variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={s.looping} aria-label="Repetir en bucle" onClick={() => engine.setLooping(!s.looping)} />
        <Button label="Mute" variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={s.allMuted} aria-label="Silenciar todo el sonido (interno y externo)" onClick={engine.toggleMasterMute} />
        <span className="mts-dock__status" aria-live="polite">{s.status}</span>
        <span className="mts-dock__time">{engine.fmt(shown)} / {engine.fmt(s.duration)}</span>
      </div>
    </div>
  );
}
