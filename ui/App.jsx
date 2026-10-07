import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import Button from 'trama-ui/Button';
import Marquee from 'trama-ui/Marquee';
import NavBar from 'trama-ui/NavBar';
import Select from 'trama-ui/Select';
import Toast from 'trama-ui/Toast';
import Tooltip from 'trama-ui/Tooltip';
import { tokensToStyle } from 'trama-ui/tokens';
import * as engine from './engine.js';
import { LANGS, lang, t } from './i18n.js';
// El fondo 3D (three.js, react-three-fiber y RetroCanvas) pesa más que el resto de la app junta:
// va en un trozo aparte que se descarga después de pintar la interfaz.
const Stage = lazy(() => import('./Stage.jsx'));

// Tema: el de la landing SILO de Trama. Negro, blanco y un solo gris; sin
// superficies ni radios. El único ornamento es el fondo (RetroCanvas).
const FONT = 'var(--font-inter), ui-sans-serif, system-ui, sans-serif';
const TOKENS = {
  dark: tokensToStyle({ bg: '#000000', fg: '#f2f2f2', mut: '#7a7a7a', acc: '#ffffff', acc2: '#7a7a7a', card: 'transparent', ln: 'rgba(255,255,255,0.14)', r: 0, font: FONT, display: FONT }),
  // el mismo tema en negativo: papel claro y tinta negra
  light: tokensToStyle({ bg: '#f2f2f2', fg: '#0a0a0a', mut: '#6a6a6a', acc: '#000000', acc2: '#6a6a6a', card: 'transparent', ln: 'rgba(0,0,0,0.18)', r: 0, font: FONT, display: FONT }),
};
// El tema elegido se guarda y se aplica en <html data-theme> (lo lee también el contenido estático
// de la página; un script en el <head> lo pone antes de pintar para que no parpadee).
const THEME_KEY = 'mts.theme';
const initialTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

const TOAST_ID = 'mts-toast';
// `?bare` en la URL deja solo el fondo, sin interfaz
const BARE = new URLSearchParams(location.search).has('bare');
const CHANNELS = Array.from({ length: 16 }, (_, i) => ({ id: String(i + 1), label: t('midi.channelN', { n: i + 1 }) }));
// selector de idioma en el menú: cada idioma es una página propia (/, /en/, /de/)
const LANG_MENU = `${lang.toUpperCase()} > ${LANGS.map((l) => `${l.label}=${l.path}`).join('; ')}`;

// **negrita** y `código` dentro de un texto traducido
const rich = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part
  );

// Escenas del fondo, en el orden en que rota el botón. La elegida se recuerda entre visitas;
// `?scene=nombre` en la URL la fija (pruebas y capturas).
const SCENES = ['rings', 'spectrum', 'terrain', 'notes'];
const SCENE_KEY = 'mts.scene';
function initialScene() {
  const asked = new URLSearchParams(location.search).get('scene');
  if (SCENES.includes(asked)) return asked;
  try {
    const saved = localStorage.getItem(SCENE_KEY);
    if (SCENES.includes(saved)) return saved;
  } catch {}
  return SCENES[0];
}

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
  const [theme, setTheme] = useState(initialTheme);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  const [scene, setScene] = useState(initialScene);
  const nextScene = () => {
    const next = SCENES[(SCENES.indexOf(scene) + 1) % SCENES.length];
    setScene(next);
    try { localStorage.setItem(SCENE_KEY, next); } catch {}
  };
  const sceneButton = (
    <button type="button" className="mts__scene" aria-label={t('scene.aria', { name: t(`scene.${scene}`) })} onClick={nextScene}>
      <span>{t('scene.label')}</span> {t(`scene.${scene}`)} <i aria-hidden="true">›</i>
    </button>
  );
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

  // El texto explicativo de la página (HTML estático, bajo la app) se pliega al cargar un archivo:
  // con las pistas delante ya no hace falta, y se puede volver a abrir a mano.
  useEffect(() => {
    const fold = document.getElementById('info');
    if (fold) fold.open = !s.loaded;
  }, [s.loaded]);

  const pickFile = () => fileInput.current?.click();
  const go = (item) => {
    // sin archivo, el menú solo ofrece cargar uno
    if (item.href === '#cargar') return pickFile();
    // otro idioma: es otra página
    if (item.href?.startsWith('/')) return location.assign(item.href);
    if (item.href?.startsWith('#')) document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  };

  const stem = s.fileName.replace(/\.(mid|midi)$/i, '');
  const title = s.loaded ? stem : 'SPLIT';

  return (
    <div className={`mts ${s.loaded ? 'mts--loaded' : ''} ${s.playing ? 'mts--playing' : ''} ${visual ? 'mts--visual' : ''} ${BARE ? 'mts--bare' : ''}`} style={TOKENS[theme]}>
      <Suspense fallback={null}>
        <Stage key={theme} scene={scene} kinds={s.tracks.map((t) => (t.drum ? 'd' : 's')).join('')} shift={lookShift} onTap={visual ? nextLook : undefined} />
      </Suspense>
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
          links={visual ? '' : (s.loaded ? `${t('nav.tracks')}=#pistas\n${t('nav.keyboard')}=#teclado\n${t('nav.sound')}=#sonido` : `${t('nav.load')}=#cargar`) + `\n${LANG_MENU}`}
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
        {visual && (
          <button type="button" className="mts__full mts__scene-icon" aria-label={t('scene.aria', { name: t(`scene.${scene}`) })} onClick={nextScene}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />
            </svg>
          </button>
        )}
        <button type="button" className="mts__full" aria-pressed={visual} aria-label={visual ? t('full.exit') : t('full.enter')} onClick={toggleVisual}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {visual ? <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /> : <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />}
          </svg>
        </button>
      </header>

      <main className="mts__main">
        {/* ---------- portada: el archivo ---------- */}
        <section className="mts__hero">
          <p className="mts__label">{s.loaded ? t('hero.loaded') : t('hero.empty')}</p>
          <p className="mts__name" style={{ '--len': Math.max(title.length, 4) }}>
            {s.loaded ? (
              <button type="button" className="mts__name-btn" aria-label={t('hero.lookAria', { name: title })} onClick={nextLook}>{title}</button>
            ) : (
              <button type="button" className="mts__name-btn" aria-label={t('hero.pick')} onClick={pickFile}>{title}</button>
            )}
          </p>
          <div className="mts__hero-foot">
            <div className="mts__pick">
              <Button label={s.loaded ? t('hero.change') : t('hero.pick')} glyph="↑" glyphPosition="start" variant="minimal" intent="neutral" size="lg" className={`mts__open ${s.loaded ? 'mts__open--again' : ''}`} onClick={pickFile} />
              <p className="mts__label">{t('hero.drag')}</p>
            </div>
            <div className="mts__hero-side">
            <button type="button" className="mts__full mts__theme" aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')} onClick={toggleTheme}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path className="fill" d="M12 3.5a8.5 8.5 0 0 1 0 17z" />
              </svg>
            </button>
            {sceneButton}
            <p className="mts__label">
              {s.loaded ? (
                <>
                  <span>{s.tracks.length} {s.tracks.length === 1 ? t('hero.track') : t('hero.tracks')}</span> · {engine.fmt(s.duration)}
                </>
              ) : (
                t('hero.local')
              )}
            </p>
            </div>
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
                <p className="mts__label">{t('tracks.label')}</p>
                <div className="mts__actions">
                  <Tooltip content={s.canMerge ? t('tracks.mergedTip') : t('tracks.mergedOff')} follow={false} variant="minimal" side="bottom">
                    <Button label={t('tracks.merged')} glyph="↓" variant="minimal" intent="neutral" size="sm" disabled={!s.canMerge} onClick={engine.downloadMerged} />
                  </Tooltip>
                  <Button label={t('tracks.zip')} glyph="↓" variant="minimal" intent="neutral" emphasis="outline" size="sm" onClick={engine.downloadZip} />
                </div>
              </div>
              <TrackList tracks={s.tracks} extEnabled={s.midi.enabled} flash={s.flash} />
              <p className="mts__hint">
                {rich(t('tracks.hint'))}
              </p>
            </section>

            {/* ---------- teclado MIDI ---------- */}
            <section id="teclado" className="mts__section">
              <p className="mts__label">{t('midi.label')}</p>
              <p className="mts__statement">{t('midi.statement')}</p>
              <MidiPanel midi={s.midi} internalMuted={s.internalMuted} externalMuted={s.externalMuted} />
            </section>

            {/* ---------- bancos de sonido ---------- */}
            <section id="sonido" className="mts__section mts__section--last">
              <p className="mts__label">{t('sound.label')}</p>
              <p className="mts__statement">{t('sound.statement')}</p>
              <div className="mts__fields">
                <Pick label={t('sound.drums')} items={s.banks.drums} value={s.banks.drum} onChange={engine.setDrumBank} />
                <Pick label={t('sound.others')} items={s.banks.kits} value={s.banks.kit} onChange={engine.setKitBank} />
              </div>
              <p className="mts__hint">
                {t('sound.hint')}
              </p>
            </section>
          </>
        )}
      </main>

      {s.loaded && <Transport s={s} />}
      {dragging && (
        <div className="mts__drop" aria-hidden>
          <p>{t('drop')}</p>
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

const Track = memo(function Track({ t: tr, active, extEnabled, flashKey }) {
  const i = tr.index;
  const row = useRef(null);
  const [name, setName] = useState(tr.name);
  useEffect(() => setName(tr.name), [tr.name]);
  const commit = () => setName(engine.setTrackName(i, name));

  // ▶ localiza la pista: la trae a la vista y parpadea
  useEffect(() => {
    if (flashKey) row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [flashKey]);

  const cls = [
    'mts__track',
    active === 1 && 'is-on',
    active === 2 && 'is-on is-on-ext',
    tr.muted && 'is-muted',
    tr.routed && 'is-routed',
    tr.dimmed && 'is-dimmed',
  ].filter(Boolean).join(' ');

  return (
    <li ref={row} className={cls}>
      <span key={flashKey} className={`mts__n ${flashKey ? 'is-flash' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
      <input
        className="mts__tname"
        value={name}
        spellCheck={false}
        aria-label={t('track.nameAria', { n: i + 1 })}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="mts__meta">
        {[tr.label, tr.start > 0.05 && t('track.starts', { t: engine.fmt(tr.start) }), tr.routed && t('track.toKeyboard')].filter(Boolean).join(' · ')}
      </span>
      <div className="mts__ctrl">
        <Tip content={t('track.solo')}>
          <Button label="Solo" variant="minimal" intent="neutral" emphasis="outline" size="md" active={tr.solo} disabled={tr.routed} aria-label={t('track.solo')} onClick={() => engine.setSolo(i, !tr.solo)} />
        </Tip>
        <Tip content={tr.muted ? t('track.muted') : t('track.mute')}>
          <Button label="Mute" variant="minimal" intent="neutral" emphasis="outline" size="md" active={tr.muted} disabled={tr.routed} aria-label={tr.muted ? t('track.unmute') : t('track.mute')} onClick={() => engine.setMuted(i, !tr.muted)} />
        </Tip>
        <Tip content={extEnabled ? t('track.ext') : t('track.extOff')}>
          <Button label="EXT" variant="minimal" intent="neutral" emphasis="outline" size="md" active={tr.toExternal} disabled={!extEnabled} aria-label={t('track.extAria')} onClick={() => engine.setExternal(i, !tr.toExternal)} />
        </Tip>
        <Tip content={t('track.playFrom')}>
          <Button label="▶" variant="minimal" intent="neutral" emphasis="outline" size="md" aria-label={t('track.playFrom')} onClick={() => engine.playFromTrack(i)} />
        </Tip>
        <Tip content={t('track.download')}>
          <Button label=".mid" glyph="↓" variant="minimal" intent="neutral" emphasis="outline" size="md" aria-label={t('track.downloadAria')} onClick={() => engine.downloadTrack(i)} />
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
    const name = midi.outputs.find((o) => o.id === midi.deviceId)?.label || t('midi.fallbackName');
    const what = midi.routedNames.length
      ? t('midi.sending', { names: midi.routedNames.join(', ') }) + (externalMuted ? t('midi.sendingMuted') : '')
      : t('midi.pressExt');
    return t('midi.status', { name, ch: midi.channel, what });
  }
  if (midi.outputs.length > 0) return t('midi.choose');
  if (midi.inputs > 0) return t('midi.inputsOnly');
  return t('midi.nothing');
}

function MidiPanel({ midi, internalMuted, externalMuted }) {
  if (!midi.supported) {
    return (
      <>
        <div className="mts__fields">
          <Button label={t('midi.unavailable')} variant="minimal" intent="neutral" emphasis="outline" size="sm" disabled />
        </div>
        <p className="mts__hint">{rich(midi.secureContext ? t('midi.noSupport') : t('midi.insecure', { port: location.port }))}</p>
      </>
    );
  }

  const status = midiStatus(midi, externalMuted);
  return (
    <>
      {midi.connected ? (
        <div className="mts__fields">
          <Pick label={t('midi.device')} items={[{ id: '', label: t('midi.none') }, ...midi.outputs]} value={midi.deviceId} onChange={engine.midiSelect} />
          <Pick label={t('midi.channel')} items={CHANNELS} value={String(midi.channel)} onChange={(id) => engine.midiSetChannel(+id || 1)} />
          <div className="mts__toggles">
            <Tip content={t('midi.muteInternal')}>
              <Button label={internalMuted ? t('midi.pcOff') : t('midi.pcOn')} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={internalMuted} aria-label={t('midi.muteInternal')} onClick={() => engine.setInternalMuted(!internalMuted)} />
            </Tip>
            <Tip content={t('midi.muteExternal')}>
              <Button label={externalMuted ? t('midi.kbOff') : t('midi.kbOn')} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={externalMuted} aria-label={t('midi.muteExternal')} onClick={() => engine.setExternalMuted(!externalMuted)} />
            </Tip>
            <Button label={t('midi.rescan')} variant="minimal" intent="neutral" emphasis="link" size="sm" onClick={engine.midiRescan} />
          </div>
        </div>
      ) : (
        <div className="mts__fields">
          <Button label={t('midi.connect')} variant="minimal" intent="neutral" size="sm" loading={midi.busy} onClick={engine.midiConnect} />
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
        aria-label={t('dock.position')}
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
        <button type="button" className="mts-dock__play" aria-label={s.playing ? t('dock.pause') : t('dock.play')} onClick={engine.playPause}>
          {s.playing ? <i className="mts-dock__pause" /> : <i className="mts-dock__tri" />}
        </button>
        <Button label={t('dock.stop')} variant="minimal" intent="neutral" emphasis="ghost" size="sm" onClick={engine.stopPlayback} />
        <Button label={t('dock.loop')} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={s.looping} aria-label={t('dock.loopAria')} onClick={() => engine.setLooping(!s.looping)} />
        <Button label={t('dock.mute')} variant="minimal" intent="neutral" emphasis="ghost" size="sm" active={s.allMuted} aria-label={t('dock.muteAria')} onClick={engine.toggleMasterMute} />
        <span className="mts-dock__status" aria-live="polite">{s.status}</span>
        <span className="mts-dock__time">{engine.fmt(shown)} / {engine.fmt(s.duration)}</span>
      </div>
    </div>
  );
}
