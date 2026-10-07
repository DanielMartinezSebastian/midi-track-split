// Genera las páginas estáticas de cada idioma (web/index.html, web/en/index.html, web/de/index.html)
// y web/sitemap.xml a partir de scripts/pages/content.mjs. La app (React) se monta en #root y lee
// el idioma de <html lang>; el resto de la página es contenido que se lee sin JavaScript.
//   node scripts/build-pages.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PAGES, SITE, UPDATED, REPO, AUTHOR_URL, PROJECT_URL } from './pages/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const url = (p) => SITE + p.path;
const og = (p) => `${SITE}${p.path}og.png`;
// versión para quien no tiene ninguno de los idiomas: la inglesa
const fallback = PAGES.find((p) => p.lang === 'en');

const alternates = [
  ...PAGES.map((p) => `<link rel="alternate" hreflang="${p.lang}" href="${url(p)}" />`),
  `<link rel="alternate" hreflang="x-default" href="${url(fallback)}" />`,
];

function jsonLd(p) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url(p)}#app`,
        name: 'MIDI Track Split',
        url: url(p),
        description: p.desc,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        browserRequirements: p.requirements,
        inLanguage: p.lang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        image: og(p),
        license: 'https://opensource.org/licenses/MIT',
        codeRepository: REPO,
        dateModified: UPDATED,
        author: { '@type': 'Person', name: 'Daniel Martínez Sebastián', url: AUTHOR_URL },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url(p)}#faq`,
        inLanguage: p.lang,
        mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  });
}

const page = (p) => `<!doctype html>
<html lang="${p.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}" />
  <meta name="author" content="Daniel Martínez Sebastián" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url(p)}" />
  ${alternates.join('\n  ')}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MIDI Track Split" />
  <meta property="og:title" content="${esc(p.title)}" />
  <meta property="og:description" content="${esc(p.desc)}" />
  <meta property="og:url" content="${url(p)}" />
  <meta property="og:image" content="${og(p)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="MIDI Track Split · Daniel Martínez Sebastián" />
  <meta property="og:locale" content="${p.locale}" />
  ${PAGES.filter((o) => o !== p).map((o) => `<meta property="og:locale:alternate" content="${o.locale}" />`).join('\n  ')}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(p.title)}" />
  <meta name="twitter:description" content="${esc(p.desc)}" />
  <meta name="twitter:image" content="${og(p)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/fonts/fonts.css" />
  <link rel="stylesheet" href="/app.css" />
  <script type="application/ld+json">${jsonLd(p)}</script>
  <script type="importmap">
  {
    "imports": {
      "midi-file": "/vendor/midi-file.js",
      "jszip": "/vendor/jszip.js",
      "tone": "/vendor/tone.js",
      "@tonejs/midi": "/vendor/tonejs-midi.js",
      "smplr": "/vendor/smplr.js"
    }
  }
  </script>
</head>
<body>
  <!-- Generado por scripts/build-pages.mjs: no editar a mano. La aplicación (React) se monta en #root;
       lo de debajo es contenido estático, que se lee sin JavaScript. -->
  <div id="root"></div>

  <main class="info" id="info">
    <p class="info__label">${p.label}</p>
    <h1>${p.h1}</h1>
    <p class="info__lead">${p.lead}</p>
${p.sections.map((s) => `
    <section>
      <h2>${s.h2}</h2>
      ${s.html}
    </section>`).join('\n')}

    <section>
      <h2>${p.faqTitle}</h2>
${p.faq.map(([q, a]) => `      <h3>${q}</h3>\n      <p>${a}</p>`).join('\n')}
    </section>

    <section>
      <h2>${p.moreTitle}</h2>
      <p>${p.more}</p>
    </section>
  </main>

  <footer class="info-foot">
    <strong>MIDI Track Split</strong>
    <p>
      ${p.foot.by} <a href="${AUTHOR_URL}" rel="author">Daniel Martínez Sebastián</a> · ${p.foot.license} ·
      ${p.foot.updated} <time datetime="${UPDATED}">${p.foot.date}</time>
    </p>
    <nav class="info-foot__langs" aria-label="${p.foot.langs}">
      ${PAGES.map((o) => (o === p ? `<span aria-current="page">${o.name}</span>` : `<a href="${o.path}" hreflang="${o.lang}" lang="${o.lang}">${o.name}</a>`)).join('\n      ')}
    </nav>
    <a class="info-foot__site" href="${PROJECT_URL}">martinezsebastian.com ↗</a>
  </footer>

  <noscript><p class="info-noscript">${p.noscript}</p></noscript>
  <script type="module" src="/app.js"></script>
</body>
</html>
`;

for (const p of PAGES) {
  const file = join(root, 'web', p.path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(p));
  const words = page(p).replace(/[\s\S]*<body>/, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  console.log(`  web${p.path}index.html  ${words} palabras · título ${p.title.length} · descripción ${p.desc.length}`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.map((p) => `  <url>
    <loc>${url(p)}</loc>
    <lastmod>${UPDATED}</lastmod>
${[...PAGES.map((o) => `    <xhtml:link rel="alternate" hreflang="${o.lang}" href="${url(o)}" />`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(fallback)}" />`].join('\n')}
  </url>`).join('\n')}
</urlset>
`;
await writeFile(join(root, 'web', 'sitemap.xml'), sitemap);
console.log('  web/sitemap.xml');
