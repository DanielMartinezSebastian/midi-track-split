// Contenido estático de cada idioma: lo que scripts/build-pages.mjs escribe en web/index.html,
// web/en/index.html y web/de/index.html (y scripts/og.mjs en la imagen de compartir).
// Las palabras clave salen de los estudios hechos con SEO-APP (oct. 2026): en inglés y alemán la
// demanda medida está en «MIDI player online» y «MIDI visualizer», de ahí sus secciones propias.

export const SITE = 'https://miditracksplit.martinezsebastian.com';
export const UPDATED = '2026-10-07';
export const REPO = 'https://github.com/DanielMartinezSebastian/midi-track-split';
export const AUTHOR_URL = 'https://www.martinezsebastian.com';
export const PROJECT_URL = 'https://www.martinezsebastian.com/herramientas/midi-track-split';

export const PAGES = [
  {
    lang: 'es',
    locale: 'es_ES',
    path: '/',
    name: 'Español',
    title: 'Separar pistas MIDI online · MIDI Track Split',
    desc: 'Separar pistas MIDI online y gratis: divide un archivo MIDI en pistas individuales, escúchalas con reproductor y visualizador 3D y descárgalas. Sin subir nada.',
    label: 'Qué es',
    h1: 'Separar pistas MIDI online',
    lead: 'MIDI Track Split es una herramienta gratuita para <strong>separar las pistas de un archivo MIDI</strong> directamente en el navegador. Cargas un <code>.mid</code>, lo divide en una pista por instrumento, puedes escucharlas juntas o por separado y descargarlas. No hay que instalar nada ni crear una cuenta.',
    sections: [
      {
        h2: 'Cómo dividir un archivo MIDI en pistas',
        html: `<ol>
        <li><strong>Carga el archivo.</strong> Pulsa «Elegir archivo .mid» o arrástralo a la ventana. Se admiten <code>.mid</code> y <code>.midi</code>.</li>
        <li><strong>Escucha y ajusta.</strong> Cada pista aparece con su instrumento. Puedes renombrarla, silenciarla, oírla en solitario o empezar a reproducir desde su primera nota.</li>
        <li><strong>Descarga.</strong> Baja cada pista como un <code>.mid</code> independiente, todas en un <code>.zip</code>, o un único MIDI combinado sin las pistas silenciadas.</li>
      </ol>
      <p>Cada pista extraída conserva el tempo, el compás y la tonalidad de la canción, así que suena igual que dentro del original.</p>`,
      },
      {
        h2: 'Reproductor MIDI online y visualizador 3D',
        html: `<p>Además de extraer pistas, funciona como <strong>reproductor MIDI</strong> (un <em>MIDI player online</em>): puedes reproducir un MIDI sin instalar nada, y cada pista suena con su instrumento General MIDI usando muestras reales, y puedes cambiar el banco de sonidos y la caja de ritmos.</p>
      <p>El fondo es un <strong>visualizador MIDI</strong> en 3D. La batería es el núcleo y cada pista un anillo que dibuja su forma de onda y se ilumina con sus notas. Solo se ven las pistas activas, y el botón de pantalla completa deja únicamente las visuales.</p>`,
      },
      {
        h2: 'Enviar una pista a un teclado o sintetizador MIDI',
        html: '<p>Con un dispositivo MIDI conectado puedes mandar cualquier pista a tu teclado o sintetizador y dejar el resto sonando en el equipo. Usa la API Web MIDI, disponible en Chrome, Edge y Opera.</p>',
      },
      {
        h2: 'Qué hacer con las pistas separadas',
        html: `<p>Extraer las pistas de un MIDI sirve para trabajar con cada instrumento por su cuenta. Estos son los usos más habituales:</p>
      <ul>
        <li><strong>Importarlas en un DAW.</strong> Arrastra cada <code>.mid</code> a una pista de Ableton Live, FL Studio, Logic, Reaper o Cubase y asígnale el instrumento virtual que quieras. Como todas conservan el tempo y el compás, quedan alineadas entre sí.</li>
        <li><strong>Practicar tu instrumento.</strong> Silencia tu parte y toca encima del resto, o deja en solitario la línea que quieres aprender y escúchala las veces que haga falta con el bucle activado.</li>
        <li><strong>Hacer un arreglo o una base.</strong> Quita la melodía para quedarte con el acompañamiento, o descarga un MIDI combinado solo con las pistas que te interesan.</li>
        <li><strong>Estudiar una canción.</strong> Renombra las pistas, mira cuándo entra cada instrumento y salta directamente a su primera nota.</li>
        <li><strong>Tocar con hardware.</strong> Manda el bajo o la melodía a tu sintetizador mientras el ordenador reproduce las demás.</li>
      </ul>`,
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      ['¿Se sube mi archivo MIDI a algún servidor?', 'No. El archivo se lee y se separa en tu propio navegador; no se envía a ningún servidor. Lo único que se descarga de internet son las muestras de sonido de los instrumentos.'],
      ['¿Es gratis?', 'Sí. MIDI Track Split es gratuito, sin registro y de código abierto con licencia MIT.'],
      ['¿Qué archivos admite y qué descargo?', 'Admite archivos .mid y .midi. Puedes descargar cada pista como un .mid independiente, todas juntas en un .zip, o un único MIDI combinado sin las pistas que hayas silenciado y con los nombres que hayas cambiado.'],
      ['¿Funciona en el móvil?', 'Sí. La interfaz está pensada para móvil y tablet. La salida a un teclado MIDI externo necesita un navegador con Web MIDI (Chrome, Edge u Opera) y no está disponible en iPhone ni iPad.'],
      ['¿Las pistas separadas suenan igual que el original?', 'Sí. Cada pista conserva el tempo, el compás y la tonalidad de la canción, así que suena igual que dentro del archivo original.'],
    ],
    moreTitle: 'Más sobre el proyecto',
    more: `También hay una versión de línea de comandos para separar pistas MIDI desde la terminal. El código está en <a href="${REPO}" rel="noopener">GitHub</a> y la historia del proyecto en su <a href="${PROJECT_URL}">ficha en martinezsebastian.com</a>. La herramienta también está disponible en <a href="/en/" hreflang="en">inglés</a> y en <a href="/de/" hreflang="de">alemán</a>.`,
    foot: { by: 'Hecho por', license: 'Licencia MIT', updated: 'Actualizado en', date: 'octubre de 2026', langs: 'Idiomas' },
    noscript: 'La herramienta necesita JavaScript para cargar, reproducir y separar el archivo MIDI.',
    requirements: 'Requiere JavaScript. La salida a teclado MIDI necesita Web MIDI (Chrome, Edge u Opera).',
    og: { sub: 'Separa un MIDI en pistas, escúchalo y descárgalas.', by: 'Por' },
  },
  {
    lang: 'en',
    locale: 'en_US',
    path: '/en/',
    name: 'English',
    title: 'Split MIDI Tracks Online · MIDI Track Split',
    desc: 'Split MIDI tracks online for free: separate a MIDI file into individual tracks, listen with an online MIDI player and 3D visualizer, then download. No upload.',
    label: 'What it is',
    h1: 'Split MIDI tracks online',
    lead: 'MIDI Track Split is a free tool to <strong>split a MIDI file into separate tracks</strong> right in your browser. Load a <code>.mid</code> and it gives you one track per instrument, which you can play together or on their own and then download. Nothing to install and no account needed.',
    sections: [
      {
        h2: 'How to split a MIDI file into tracks',
        html: `<ol>
        <li><strong>Load the file.</strong> Press “Choose .mid file” or drop it on the window. Both <code>.mid</code> and <code>.midi</code> files work.</li>
        <li><strong>Listen and adjust.</strong> Each track shows up with its instrument. You can rename it, mute it, solo it or start playback from its first note.</li>
        <li><strong>Download.</strong> Save each track as its own <code>.mid</code>, all of them in a <code>.zip</code>, or a single merged MIDI without the tracks you muted.</li>
      </ol>
      <p>Every extracted track keeps the tempo, time signature and key of the song, so it sounds exactly as it did inside the original file.</p>`,
      },
      {
        h2: 'Online MIDI player',
        html: `<p>It also works as an <strong>online MIDI player</strong>: play a MIDI file online without installing anything. Each track uses its General MIDI instrument with real samples, and you can switch the sound bank and the drum machine.</p>
      <p>The player has solo and mute per track, a loop button and a seek bar, and it can start from the first note of any track, which is handy for finding where an instrument comes in.</p>`,
      },
      {
        h2: 'MIDI visualizer online, in 3D',
        html: '<p>The background is a <strong>3D MIDI visualizer</strong> driven by the music. The drums are the core and every other track is a ring that draws its real waveform and lights up with its notes. Only active tracks are shown, so muting or soloing changes the picture. The full-screen button hides the interface and leaves just the visuals; tap the canvas to change the render style.</p>',
      },
      {
        h2: 'Send a track to a MIDI keyboard or synth',
        html: '<p>With a MIDI device connected you can route any track to your keyboard or synthesizer while the rest keeps playing on your computer. It uses the Web MIDI API, available in Chrome, Edge and Opera.</p>',
      },
      {
        h2: 'What to do with the separated tracks',
        html: `<p>Separating MIDI tracks lets you work with each instrument on its own. The most common uses:</p>
      <ul>
        <li><strong>Import them into a DAW.</strong> Drag each <code>.mid</code> onto a track in Ableton Live, FL Studio, Logic, Reaper or Cubase and assign any virtual instrument. They all keep the tempo and time signature, so they stay lined up.</li>
        <li><strong>Practice your instrument.</strong> Mute your part and play over the rest, or solo the line you want to learn and loop it as many times as you need.</li>
        <li><strong>Make an arrangement or a backing track.</strong> Drop the melody to keep the accompaniment, or download a merged MIDI with only the tracks you want.</li>
        <li><strong>Study a song.</strong> Rename the tracks, see when each instrument enters and jump straight to its first note.</li>
        <li><strong>Play with hardware.</strong> Send the bass or the lead to your synth while the computer plays everything else.</li>
      </ul>`,
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      ['Is my MIDI file uploaded to a server?', 'No. The file is read and split in your own browser and is never sent to a server. The only thing downloaded from the internet is the instrument sound samples.'],
      ['Is it free?', 'Yes. MIDI Track Split is free, needs no sign-up and is open source under the MIT license.'],
      ['Which files does it accept and what can I download?', 'It accepts .mid and .midi files. You can download each track as a separate .mid, all of them together in a .zip, or a single merged MIDI without the tracks you muted and with the names you changed.'],
      ['How do I separate MIDI drums into their own track?', 'Load the file and download the drum track with its .mid button. If the drums are on their own track in the file, you get them as a standalone MIDI that keeps the tempo of the song.'],
      ['Does it work on a phone?', 'Yes. The interface is designed for phones and tablets. Sending a track to an external MIDI keyboard needs a browser with Web MIDI (Chrome, Edge or Opera) and is not available on iPhone or iPad.'],
      ['Do the separated tracks sound like the original?', 'Yes. Each track keeps the tempo, time signature and key of the song, so it sounds the same as inside the original file.'],
    ],
    moreTitle: 'More about the project',
    more: `There is also a command-line version to split MIDI tracks from the terminal. The code is on <a href="${REPO}" rel="noopener">GitHub</a> and the story of the project is on its <a href="${PROJECT_URL}">page at martinezsebastian.com</a> (in Spanish). The tool is also available in <a href="/" hreflang="es">Spanish</a> and <a href="/de/" hreflang="de">German</a>.`,
    foot: { by: 'Made by', license: 'MIT license', updated: 'Updated', date: 'October 2026', langs: 'Languages' },
    noscript: 'The tool needs JavaScript to load, play and split the MIDI file.',
    requirements: 'Requires JavaScript. Output to a MIDI keyboard needs Web MIDI (Chrome, Edge or Opera).',
    og: { sub: 'Split a MIDI file into tracks, play it and download them.', by: 'By' },
  },
  {
    lang: 'de',
    locale: 'de_DE',
    path: '/de/',
    name: 'Deutsch',
    title: 'MIDI-Spuren trennen online · MIDI Track Split',
    desc: 'MIDI-Spuren online trennen, kostenlos: MIDI-Datei in einzelne Spuren aufteilen, mit MIDI Player online und 3D-Visualizer anhören und herunterladen. Ohne Upload.',
    label: 'Worum es geht',
    h1: 'MIDI-Spuren trennen – online',
    lead: 'MIDI Track Split ist ein kostenloses Tool, mit dem du <strong>MIDI-Spuren trennen</strong> kannst – direkt im Browser. Du lädst eine <code>.mid</code>-Datei (MIDI file), bekommst eine Spur pro Instrument, kannst sie zusammen oder einzeln anhören und herunterladen. Keine Installation, kein Konto.',
    sections: [
      {
        h2: 'So teilst du eine MIDI-Datei in Spuren auf',
        html: `<ol>
        <li><strong>Datei laden.</strong> Klicke auf „.mid-Datei wählen“ oder ziehe sie ins Fenster. Unterstützt werden <code>.mid</code> und <code>.midi</code>.</li>
        <li><strong>Anhören und anpassen.</strong> Jede Spur erscheint mit ihrem Instrument. Du kannst sie umbenennen, stummschalten, solo hören oder die Wiedergabe bei ihrer ersten Note starten.</li>
        <li><strong>Herunterladen.</strong> Speichere jede Spur als eigene <code>.mid</code>, alle zusammen als <code>.zip</code> oder eine einzige MIDI-Datei ohne die stummgeschalteten Spuren.</li>
      </ol>
      <p>Jede extrahierte Spur behält Tempo, Taktart und Tonart des Songs und klingt deshalb genau wie in der Originaldatei.</p>`,
      },
      {
        h2: 'MIDI Player online',
        html: `<p>Das Tool ist zugleich ein <strong>Online-MIDI-Player</strong>: Du kannst eine MIDI-Datei abspielen, ohne etwas zu installieren. Jede Spur nutzt ihr General-MIDI-Instrument mit echten Samples; Soundbank und Drumcomputer lassen sich wechseln.</p>
      <p>Der Player bietet Solo und Mute pro Spur, eine Loop-Funktion und eine Fortschrittsleiste. Außerdem kann er bei der ersten Note einer beliebigen Spur starten – praktisch, um den Einsatz eines Instruments zu finden.</p>`,
      },
      {
        h2: 'MIDI Visualizer online, in 3D',
        html: '<p>Der Hintergrund ist ein <strong>3D MIDI Visualizer</strong>, der auf die Musik reagiert. Das Schlagzeug ist der Kern, jede weitere Spur ein Ring, der ihre echte Wellenform zeichnet und mit ihren Noten aufleuchtet. Zu sehen sind nur die aktiven Spuren – Mute und Solo verändern also das Bild. Der Vollbild-Button blendet die Oberfläche aus und zeigt nur die Visuals; ein Tippen auf die Fläche wechselt den Render-Stil.</p>',
      },
      {
        h2: 'Eine Spur an ein MIDI-Keyboard oder einen Synthesizer senden',
        html: '<p>Ist ein MIDI-Gerät angeschlossen, kannst du jede Spur an dein Keyboard oder deinen Synthesizer schicken, während der Rest auf dem Rechner weiterläuft. Dafür wird die Web-MIDI-API genutzt, die es in Chrome, Edge und Opera gibt.</p>',
      },
      {
        h2: 'Was du mit den getrennten Spuren machen kannst',
        html: `<p>MIDI-Spuren zu extrahieren lohnt sich, wenn du mit jedem Instrument einzeln arbeiten willst. Die häufigsten Anwendungen:</p>
      <ul>
        <li><strong>In eine DAW importieren.</strong> Ziehe jede <code>.mid</code> auf eine Spur in Ableton Live, FL Studio, Logic, Reaper oder Cubase und weise ihr ein beliebiges virtuelles Instrument zu. Da alle Tempo und Taktart behalten, bleiben sie synchron.</li>
        <li><strong>Dein Instrument üben.</strong> Schalte deine Stimme stumm und spiele zum Rest, oder höre die Linie, die du lernen willst, solo und im Loop.</li>
        <li><strong>Ein Arrangement oder Playback bauen.</strong> Nimm die Melodie heraus und behalte die Begleitung, oder lade eine MIDI-Datei nur mit den Spuren herunter, die du brauchst.</li>
        <li><strong>Einen Song analysieren.</strong> Benenne die Spuren um, sieh, wann welches Instrument einsetzt, und springe direkt zu seiner ersten Note.</li>
        <li><strong>Mit Hardware spielen.</strong> Schicke Bass oder Melodie an deinen Synthesizer, während der Computer den Rest abspielt.</li>
      </ul>`,
      },
    ],
    faqTitle: 'Häufige Fragen',
    faq: [
      ['Wird meine MIDI-Datei auf einen Server hochgeladen?', 'Nein. Die Datei wird in deinem Browser gelesen und aufgeteilt und nie an einen Server gesendet. Aus dem Internet geladen werden nur die Klang-Samples der Instrumente.'],
      ['Ist das kostenlos?', 'Ja. MIDI Track Split ist kostenlos, ohne Anmeldung und Open Source unter der MIT-Lizenz.'],
      ['Welche Dateien werden unterstützt und was kann ich herunterladen?', 'Unterstützt werden .mid- und .midi-Dateien. Du kannst jede Spur als eigene .mid herunterladen, alle zusammen als .zip oder eine einzige MIDI-Datei ohne die stummgeschalteten Spuren und mit den geänderten Namen.'],
      ['Funktioniert es auf dem Handy?', 'Ja. Die Oberfläche ist für Smartphone und Tablet ausgelegt. Die Ausgabe an ein externes MIDI-Keyboard braucht einen Browser mit Web MIDI (Chrome, Edge oder Opera) und ist auf iPhone und iPad nicht verfügbar.'],
      ['Klingen die getrennten Spuren wie das Original?', 'Ja. Jede Spur behält Tempo, Taktart und Tonart des Songs und klingt daher wie in der Originaldatei.'],
    ],
    moreTitle: 'Mehr zum Projekt',
    more: `Es gibt auch eine Kommandozeilen-Version, um MIDI-Spuren im Terminal zu trennen. Der Code liegt auf <a href="${REPO}" rel="noopener">GitHub</a>, die Geschichte des Projekts steht auf der <a href="${PROJECT_URL}">Projektseite bei martinezsebastian.com</a> (auf Spanisch). Das Tool gibt es auch auf <a href="/" hreflang="es">Spanisch</a> und <a href="/en/" hreflang="en">Englisch</a>.`,
    foot: { by: 'Von', license: 'MIT-Lizenz', updated: 'Aktualisiert im', date: 'Oktober 2026', langs: 'Sprachen' },
    noscript: 'Das Tool braucht JavaScript, um die MIDI-Datei zu laden, abzuspielen und aufzuteilen.',
    requirements: 'Benötigt JavaScript. Die Ausgabe an ein MIDI-Keyboard braucht Web MIDI (Chrome, Edge oder Opera).',
    og: { sub: 'MIDI-Datei in Spuren trennen, anhören und herunterladen.', by: 'Von' },
  },
];
