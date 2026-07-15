import { escapeHtml, jsonForInlineScript, PUBLIC_ORIGIN } from './html.js';

export interface CityStats {
  id: string;
  name: string;
  listingsCount: number;
  lostDwellings: number;
  lostFamilies: number;
  lostInhabitants: number;
  lostCommercial: number;
  updatedAt: Date | null;
}

export interface NeighborhoodStats {
  name: string;
  lostDwellings: number;
  lostFamilies: number;
  lostCommercial: number;
}

const numberFormatter = new Intl.NumberFormat('es-ES');
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeZone: 'Europe/Madrid',
});

function n(value: number): string {
  return numberFormatter.format(value);
}

const SHARED_CSS = `
  :root{color-scheme:light}
  *{box-sizing:border-box;margin:0}
  body{font:16px/1.6 system-ui,-apple-system,sans-serif;background:#f7f3eb;color:#1e2b27;padding:0 20px 48px}
  main{max-width:760px;margin:0 auto}
  header.site{display:flex;align-items:center;gap:10px;max-width:760px;margin:0 auto;padding:20px 0}
  header.site a{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:700}
  .mark{width:30px;height:30px;border-radius:9px;background:#d9604c;display:inline-grid;place-items:center;color:#fff;font-size:15px}
  h1{font-size:1.75rem;line-height:1.25;letter-spacing:-.02em;margin:14px 0 4px}
  .updated{color:#65716c;font-size:.85rem}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:22px 0}
  .stat{background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px;padding:14px 16px}
  .stat strong{display:block;font-size:1.6rem;letter-spacing:-.02em;color:#9b3b30}
  .stat span{font-size:.82rem;color:#65716c}
  .cta{display:inline-block;background:#315d4c;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;margin:6px 0 26px}
  h2{font-size:1.15rem;margin:26px 0 10px}
  p{margin:10px 0;color:#3c4a44}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px;overflow:hidden;font-size:.92rem}
  th,td{text-align:left;padding:9px 14px;border-top:1px solid rgba(30,43,39,.08)}
  thead th{border-top:0;background:rgba(49,93,76,.07);font-size:.8rem;color:#3c4a44}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .note{background:rgba(217,96,76,.08);border:1px solid rgba(217,96,76,.25);border-radius:14px;padding:12px 16px;font-size:.88rem;margin:24px 0}
  footer{max-width:760px;margin:34px auto 0;padding-top:18px;border-top:1px solid rgba(30,43,39,.12);font-size:.85rem;color:#65716c}
  footer a,main a{color:#315d4c}
  ul.cities{list-style:none;padding:0;display:grid;gap:10px}
  ul.cities li{background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px}
  ul.cities a{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;text-decoration:none;color:inherit;font-weight:650}
  ul.cities small{color:#65716c;font-weight:500}
`;

function pageShell(options: {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: unknown;
  body: string;
}): string {
  const canonicalUrl = `${PUBLIC_ORIGIN}${options.canonicalPath}`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeHtml(options.description)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="es_ES">
    <meta property="og:site_name" content="Viviendas Perdidas">
    <meta property="og:title" content="${escapeHtml(options.title)}">
    <meta property="og:description" content="${escapeHtml(options.description)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtml(`${PUBLIC_ORIGIN}/og.png`)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(options.title)}">
    <meta name="twitter:description" content="${escapeHtml(options.description)}">
    <meta name="twitter:image" content="${escapeHtml(`${PUBLIC_ORIGIN}/og.png`)}">
    <script type="application/ld+json">${jsonForInlineScript(options.jsonLd)}</script>
    <style>${SHARED_CSS}</style>
  </head>
  <body>
    <header class="site">
      <a href="/"><span class="mark" aria-hidden="true">⌂</span> Viviendas Perdidas</a>
    </header>
    <main>${options.body}</main>
    <footer>
      Proyecto ciudadano independiente y sin ánimo de lucro. Datos colaborativos y no oficiales.
      <a href="/metodologia">Metodología</a> · <a href="/acerca">Acerca del proyecto</a> ·
      <a href="/ciudades">Datos por ciudad</a>
    </footer>
  </body>
</html>`;
}

export function renderCityPage(city: CityStats, neighborhoods: NeighborhoodStats[]): string {
  const name = city.name;
  const title = `Viviendas perdidas en ${name}: ${n(city.lostDwellings)} viviendas y ${n(city.lostFamilies)} familias`;
  const description = `${name} ha perdido ${n(city.lostDwellings)} viviendas por apartamentos turísticos: unas ${n(city.lostFamilies)} familias y ${n(city.lostInhabitants)} habitantes desplazados según los registros colaborativos del mapa.`;
  const updatedLine = city.updatedAt
    ? `<p class="updated">Actualizado el ${escapeHtml(dateFormatter.format(city.updatedAt))} · ${n(city.listingsCount)} ${city.listingsCount === 1 ? 'registro' : 'registros'}</p>`
    : '';
  const neighborhoodRows = neighborhoods
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.name)}</td><td class="num">${n(entry.lostDwellings)}</td><td class="num">${n(entry.lostFamilies)}</td><td class="num">${n(entry.lostCommercial)}</td></tr>`,
    )
    .join('');
  const neighborhoodsSection =
    neighborhoods.length > 0
      ? `<h2>Desglose por barrios</h2>
        <table>
          <thead><tr><th>Barrio</th><th class="num">Viviendas</th><th class="num">Familias</th><th class="num">Locales</th></tr></thead>
          <tbody>${neighborhoodRows}</tbody>
        </table>
        <p class="updated">La asignación a barrios es aproximada.</p>`
      : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Viviendas perdidas por apartamentos turísticos en ${name}`,
    description,
    url: `${PUBLIC_ORIGIN}/ciudad/${city.id}`,
    creator: { '@type': 'Organization', name: 'Viviendas Perdidas', url: `${PUBLIC_ORIGIN}/` },
    spatialCoverage: name,
    inLanguage: 'es',
    isAccessibleForFree: true,
    ...(city.updatedAt ? { dateModified: city.updatedAt.toISOString() } : {}),
  };
  const body = `
    <h1>Viviendas perdidas en ${escapeHtml(name)}</h1>
    ${updatedLine}
    <div class="stats">
      <div class="stat"><strong>${n(city.lostDwellings)}</strong><span>viviendas perdidas</span></div>
      <div class="stat"><strong>${n(city.lostFamilies)}</strong><span>familias desplazadas</span></div>
      <div class="stat"><strong>${n(city.lostInhabitants)}</strong><span>habitantes desplazados</span></div>
      <div class="stat"><strong>${n(city.lostCommercial)}</strong><span>comercios convertidos</span></div>
    </div>
    <a class="cta" href="/?scope=${escapeHtml(encodeURIComponent(city.id))}">Ver ${escapeHtml(name)} en el mapa</a>
    ${neighborhoodsSection}
    <h2>¿Qué significan estas cifras?</h2>
    <p>
      Cada registro del mapa documenta una vivienda, un edificio o un local comercial de
      ${escapeHtml(name)} que hoy funciona como alojamiento turístico. Las familias y habitantes
      se estiman con el tamaño medio del hogar del INE (unas 2,5 personas por vivienda), tal y
      como se explica en la <a href="/metodologia">metodología</a>.
    </p>
    <p>
      Los datos los aporta la ciudadanía y no constituyen una estadística oficial: son una
      fotografía colaborativa, verificable y en construcción de lo que el alquiler turístico
      está desplazando en ${escapeHtml(name)}.
    </p>
    <div class="note">
      ¿Conoces una vivienda convertida en apartamento turístico en ${escapeHtml(name)}?
      <a href="/?scope=${escapeHtml(encodeURIComponent(city.id))}">Regístrala en el mapa</a> —
      no hace falta cuenta y no se guarda ningún dato personal.
    </div>`;
  return pageShell({
    title,
    description,
    canonicalPath: `/ciudad/${city.id}`,
    jsonLd,
    body,
  });
}

export function renderCitiesIndex(cities: CityStats[]): string {
  const title = 'Viviendas perdidas por ciudad';
  const description =
    'Cifras de viviendas, familias y comercios desplazados por apartamentos turísticos en cada ciudad española con registros en el mapa colaborativo.';
  const items = cities
    .map(
      (city) =>
        `<li><a href="/ciudad/${escapeHtml(encodeURIComponent(city.id))}">${escapeHtml(city.name)}
          <small>${n(city.lostDwellings)} viviendas · ${n(city.lostFamilies)} familias</small></a></li>`,
    )
    .join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${PUBLIC_ORIGIN}/ciudades`,
    inLanguage: 'es',
  };
  const body = `
    <h1>Viviendas perdidas por ciudad</h1>
    <p>
      Estas son las ciudades con registros en el mapa. Cada página recoge las cifras
      actuales y su desglose por barrios.
    </p>
    <ul class="cities">${items}</ul>
    <p>¿Falta tu ciudad? <a href="/">Añade el primer registro en el mapa</a>.</p>`;
  return pageShell({ title, description, canonicalPath: '/ciudades', jsonLd, body });
}

export function renderSitemap(cities: CityStats[]): string {
  const staticEntries = ['/', '/ciudades', '/metodologia', '/acerca'].map(
    (path) => `  <url><loc>${PUBLIC_ORIGIN}${path}</loc></url>`,
  );
  const cityEntries = cities.map((city) => {
    const lastmod = city.updatedAt
      ? `<lastmod>${city.updatedAt.toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `  <url><loc>${PUBLIC_ORIGIN}/ciudad/${encodeURIComponent(city.id)}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...cityEntries].join('\n')}
</urlset>
`;
}
