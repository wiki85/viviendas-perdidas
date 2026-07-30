import { inhabitantsForDwellings } from '../domain/aggregates.js';
import {
  computeCityImpact,
  HOUSEHOLD_ANNUAL_SPEND_EUR,
  PUPILS_PER_CLASSROOM,
} from '../domain/city-impact.js';
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

/** Official registry figures for the city, when mirrored. */
export interface OfficialCityStats {
  total: number;
  entireHomes: number;
  roomsOnly: number;
  /** Displaced inhabitants from rooms-only rentals (≈1 per room). */
  roomsInhabitants: number;
  places: number;
  /** Mirrored registry ('openrta' | 'rtc'): picks the credit line. */
  source: string;
  updatedAt: Date | null;
}

/** Per-registry credit demanded by each open-data license. */
function officialCredit(source: string): string {
  if (source === 'rtc') {
    return `
    <p class="credit">
      Fuente: <a href="https://analisi.transparenciacatalunya.cat/d/t2h3-cgys" rel="noopener noreferrer">Registre de Turisme de Catalunya</a>
      (Generalitat de Catalunya, <a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies" rel="noopener noreferrer">llicència oberta d'ús d'informació</a>),
      coordenadas del <a href="https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic" rel="noopener noreferrer">Ajuntament de Barcelona</a>
      (<a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>), datos adaptados. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'gva') {
    return `
    <p class="credit">
      Fuente: <a href="https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51" rel="noopener noreferrer">Registre de Turisme de la Comunitat Valenciana</a>
      (Generalitat Valenciana), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a> ·
      coordenadas de la <a href="https://www.sedecatastro.gob.es/" rel="noopener noreferrer">Dirección General del Catastro</a>. Sin respaldo oficial.
    </p>`;
  }
  return `
    <p class="credit">
      Fuente: <a href="https://datos.gob.es/es/catalogo/a01002820-openrta" rel="noopener noreferrer">Registro de Turismo de Andalucía</a>
      (Junta de Andalucía), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>. Sin respaldo oficial.
    </p>`;
}

export type CityIndexEntry = CityStats & { officialTotal?: number };

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

/** 34.044.000 → '34 millones de €'; 620.000 → '620.000 €'. */
function euros(value: number): string {
  if (value >= 995_000) {
    const millions = value / 1_000_000;
    return `${millions.toLocaleString('es-ES', {
      maximumFractionDigits: millions >= 10 ? 0 : 1,
    })} millones de €`;
  }
  return `${numberFormatter.format(Math.round(value / 1_000) * 1_000)} €`;
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
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0 22px}
  .stat{background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px;padding:14px 16px}
  .stat strong{display:block;font-size:1.6rem;letter-spacing:-.02em;color:#9b3b30}
  .stat span{font-size:.82rem;color:#65716c}
  .stats--official .stat strong{color:#315d4c}
  .credit{font-size:.72rem;color:#65716c;margin:-12px 0 20px}
  .credit a{color:#315d4c}
  .combined{background:rgba(49,93,76,.09);border:1px solid rgba(49,93,76,.22);border-radius:14px;padding:14px 18px;margin:6px 0 24px;font-size:.98rem}
  .cta{display:inline-block;background:#315d4c;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;margin:6px 0 26px}
  h2{font-size:1.15rem;margin:26px 0 10px}
  p{margin:10px 0;color:#3c4a44}
  .impact{display:grid;gap:10px;margin:14px 0 6px}
  .impact article{display:flex;gap:14px;background:#fff;border:1px solid rgba(30,43,39,.12);border-left:4px solid #d9604c;border-radius:14px;padding:14px 16px}
  .impact .emoji{font-size:1.5rem;line-height:1.2}
  .impact p{margin:0;font-size:.93rem}
  .impact strong{color:#9b3b30}
  .impact article.green{border-left-color:#315d4c}
  .impact article.green strong{color:#315d4c}
  .share{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 6px}
  .share a,.share button{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:.86rem;font-weight:700;color:#fff;text-decoration:none;border:0;border-radius:999px;padding:9px 16px;cursor:pointer}
  .share .wa{background:#1fa855}
  .share .tw{background:#14171a}
  .share .fb{background:#1877f2}
  .share .tg{background:#1f95d4}
  .share .copy{background:#315d4c}
  .sources{font-size:.78rem;color:#65716c;margin-top:8px}
  .sources li{margin:3px 0}
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

const SHARE_SCRIPT = `
(function(){
  var button=document.querySelector('[data-share-url]');
  if(!button)return;
  if(navigator.share)button.textContent='Más opciones…';
  button.addEventListener('click',function(){
    var url=button.getAttribute('data-share-url');
    var text=button.getAttribute('data-share-text')||'';
    if(navigator.share){navigator.share({title:document.title,text:text,url:url}).catch(function(){});return;}
    if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){
      button.textContent='¡Enlace copiado!';
      setTimeout(function(){button.textContent='Copiar enlace';},2000);
    });}
  });
})();
`;

function pageShell(options: {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: unknown;
  body: string;
  withShareScript?: boolean;
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
    ${options.withShareScript ? `<script>${SHARE_SCRIPT}</script>` : ''}
  </body>
</html>`;
}

function shareSection(cityName: string, cityId: string, text: string): string {
  const url = `${PUBLIC_ORIGIN}/ciudad/${encodeURIComponent(cityId)}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedBoth = encodeURIComponent(`${text} ${url}`);
  return `
    <h2 id="compartir">Comparte lo que pierde ${escapeHtml(cityName)}</h2>
    <p>
      Estas cifras cambian conversaciones. Compártelas con tus vecinos, tu grupo del barrio o
      tu ayuntamiento:
    </p>
    <div class="share">
      <a class="wa" href="https://wa.me/?text=${encodedBoth}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a class="tw" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer">X</a>
      <a class="fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer">Facebook</a>
      <a class="tg" href="https://t.me/share/url?url=${encodedUrl}&text=${encodedText}" target="_blank" rel="noopener noreferrer">Telegram</a>
      <button class="copy" type="button" data-share-url="${escapeHtml(url)}" data-share-text="${escapeHtml(text)}">Copiar enlace</button>
    </div>`;
}

export function renderCityPage(
  city: CityStats,
  neighborhoods: NeighborhoodStats[],
  official: OfficialCityStats | null = null,
): string {
  const name = city.name;
  const officialEntire = official?.entireHomes ?? 0;
  const households = city.lostFamilies + officialEntire;
  const inhabitants =
    city.lostInhabitants +
    (officialEntire > 0 ? inhabitantsForDwellings(officialEntire, city.id) : 0) +
    // Rooms-only rentals add inhabitants (≈1 per rented room), not households.
    (official?.roomsInhabitants ?? 0);
  const totalDwellings = city.lostDwellings + (official?.total ?? 0);
  const impact = computeCityImpact({
    cityId: city.id,
    households,
    inhabitants,
    officialTotal: official?.total ?? 0,
    officialPlaces: official?.places ?? 0,
  });

  const title = `Viviendas perdidas en ${name}: ${n(totalDwellings)} viviendas dedicadas al turismo`;
  const description =
    households > 0
      ? `${name} dedica ${n(totalDwellings)} viviendas al alquiler turístico: unas ${n(households)} familias desplazadas, ${euros(impact.annualSpendEur)} al año que pierde la economía de barrio y el equivalente a ${n(impact.classrooms)} aulas escolares.`
      : `Datos colaborativos de viviendas convertidas en alojamiento turístico en ${name}.`;
  const updatedAt = city.updatedAt ?? official?.updatedAt ?? null;
  const updatedLine = updatedAt
    ? `<p class="updated">Actualizado el ${escapeHtml(dateFormatter.format(updatedAt))} · ${n(city.listingsCount)} ${city.listingsCount === 1 ? 'registro vecinal' : 'registros vecinales'}${official ? ` · registro oficial de turismo` : ''}</p>`
    : '';

  const communitySection = `
    ${official ? '<h2>Registros vecinales</h2>' : ''}
    <div class="stats">
      <div class="stat"><strong>${n(city.lostDwellings)}</strong><span>viviendas perdidas</span></div>
      <div class="stat"><strong>${n(city.lostFamilies)}</strong><span>familias desplazadas</span></div>
      <div class="stat"><strong>${n(city.lostInhabitants)}</strong><span>habitantes desplazados</span></div>
      <div class="stat"><strong>${n(city.lostCommercial)}</strong><span>comercios convertidos</span></div>
    </div>`;

  const officialSection = official
    ? `
    <h2>Registro oficial de turismo</h2>
    <div class="stats stats--official">
      <div class="stat"><strong>${n(official.total)}</strong><span>viviendas turísticas registradas</span></div>
      <div class="stat"><strong>${n(official.entireHomes)}</strong><span>viviendas completas</span></div>
      <div class="stat"><strong>${n(official.roomsOnly)}</strong><span>solo por habitaciones</span></div>
      <div class="stat"><strong>${n(official.places)}</strong><span>plazas turísticas</span></div>
    </div>
    ${officialCredit(official.source)}
    <div class="combined">
      Sumando ambas fuentes, ${escapeHtml(name)} dedica <strong>${n(totalDwellings)} viviendas</strong>
      al alquiler turístico: unos <strong>${n(households)} hogares</strong> y
      <strong>${n(inhabitants)} personas</strong> que ya no pueden vivir donde había casas.
      Las «solo por habitaciones» no se cuentan como hogar desplazado.
    </div>`
    : '';

  const impactCards: string[] = [];
  if (households > 0) {
    impactCards.push(`
      <article>
        <span class="emoji" aria-hidden="true">🛒</span>
        <p><strong>${euros(impact.annualSpendEur)} al año</strong> dejan de gastarse donde vivían
        esos hogares (gasto medio por hogar: ${n(HOUSEHOLD_ANNUAL_SPEND_EUR)} €, EPF 2024 del INE).
        De ellos, <strong>${euros(impact.foodSpendEur)}</strong> solo en alimentación: el gasto que
        sostiene mercados, fruterías y panaderías de barrio.</p>
      </article>`);
  }
  if (impact.under15 > 0) {
    impactCards.push(`
      <article>
        <span class="emoji" aria-hidden="true">🏫</span>
        <p><strong>≈${n(impact.under15)} menores de 15 años</strong> menos viviendo en esas casas
        (el 13,8% de la población, INE)${
          impact.classrooms > 0
            ? `: el equivalente a <strong>${n(impact.classrooms)} ${impact.classrooms === 1 ? 'aula escolar' : 'aulas escolares'}</strong> (a ${PUPILS_PER_CLASSROOM} alumnos por aula, media estatal)`
            : ''
        }. Menos niños en el barrio significa colegios que cierran líneas y plazas que pierden vida.</p>
      </article>`);
  }
  if (impact.officialStockSharePct !== null) {
    impactCards.push(`
      <article class="green">
        <span class="emoji" aria-hidden="true">🏠</span>
        <p>Las viviendas turísticas oficiales equivalen ya al
        <strong>${impact.officialStockSharePct.toLocaleString('es-ES')}% de todos los hogares principales</strong>
        de la ciudad (Censo 2021). La evidencia académica sobre Barcelona estima que la irrupción
        del alquiler turístico elevó los alquileres un <strong>1,9% de media</strong> —hasta un 7%
        en las zonas más saturadas— y un <strong>4,6% los precios de compraventa</strong>
        (García-López et al., <em>Journal of Urban Economics</em>, 2020).</p>
      </article>`);
  }
  if (impact.placesPer100 !== null) {
    impactCards.push(`
      <article class="green">
        <span class="emoji" aria-hidden="true">🧳</span>
        <p>Hay <strong>${impact.placesPer100.toLocaleString('es-ES')} plazas turísticas oficiales por
        cada 100 vecinos</strong>. Cada plaza es una cama que compite con la vida de barrio:
        donde había rutinas, saludos y memoria compartida, rotan maletas cada pocos días.</p>
      </article>`);
  }
  if (city.lostCommercial > 0) {
    impactCards.push(`
      <article>
        <span class="emoji" aria-hidden="true">🏪</span>
        <p><strong>${n(city.lostCommercial)} ${city.lostCommercial === 1 ? 'local de barrio convertido' : 'locales de barrio convertidos'}</strong>
        en alojamiento turístico según los registros vecinales. Cada persiana que se convierte
        es una tienda, un taller o un bar de vecinos que no volverá: la identidad de
        ${escapeHtml(name)} también se desplaza.</p>
      </article>`);
  }
  const impactSection =
    impactCards.length > 0
      ? `
    <h2>Lo que pierde ${escapeHtml(name)}</h2>
    <p>
      Traducimos los hogares desplazados a impactos concretos usando estadísticas públicas.
      Son estimaciones prudentes y auditables; el detalle está en la
      <a href="/metodologia">metodología</a> y en las fuentes de abajo.
    </p>
    <div class="impact">${impactCards.join('')}</div>
    <ul class="sources">
      <li>Gasto de los hogares: <a href="https://www.ine.es/dyngs/Prensa/EPF2024.htm" rel="noopener noreferrer">INE, Encuesta de Presupuestos Familiares 2024</a> (34.044 €/hogar; 15,8% en alimentación).</li>
      <li>Población menor de 15 años (13,8%): <a href="https://www.ine.es" rel="noopener noreferrer">INE, estructura de población</a>. Media de ${PUPILS_PER_CLASSROOM} alumnos por aula: Ministerio de Educación, curso 2023-24.</li>
      ${impact.officialStockSharePct !== null ? `<li>Hogares principales (Censo 2021) y población municipal: <a href="https://www.juntadeandalucia.es/institutodeestadisticaycartografia/sima/" rel="noopener noreferrer">IECA, SIMA</a>.</li>` : ''}
      ${impact.officialStockSharePct !== null ? `<li>Efecto sobre alquileres y precios: <a href="https://doi.org/10.1016/j.jue.2020.103278" rel="noopener noreferrer">García-López, Jofre-Monseny, Martínez-Mazza y Segú (2020), «Do short-term rental platforms affect housing markets?»</a>.</li>` : ''}
    </ul>`
      : '';

  const shareText =
    households > 0
      ? `${name} dedica ${n(totalDwellings)} viviendas al alquiler turístico: ${n(households)} hogares desplazados, ${euros(impact.annualSpendEur)}/año que pierde el comercio local y ${n(impact.classrooms)} aulas vacías.`
      : `Mira cuántas viviendas ha perdido ${name} por el alquiler turístico.`;

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
        <p class="updated">La asignación a barrios es aproximada y solo refleja registros vecinales.</p>`
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
    ...(updatedAt ? { dateModified: updatedAt.toISOString() } : {}),
  };

  const mapQuery = official
    ? `scope=${encodeURIComponent(city.id)}&fuente=ambas`
    : `scope=${encodeURIComponent(city.id)}`;
  const body = `
    <h1>Viviendas perdidas en ${escapeHtml(name)}</h1>
    ${updatedLine}
    ${communitySection}
    ${officialSection}
    <a class="cta" href="/?${escapeHtml(mapQuery)}">Ver ${escapeHtml(name)} en el mapa</a>
    ${impactSection}
    ${shareSection(name, city.id, shareText)}
    ${neighborhoodsSection}
    <h2>¿Qué significan estas cifras?</h2>
    <p>
      Cada registro vecinal documenta una vivienda, un edificio o un local de
      ${escapeHtml(name)} que hoy funciona como alojamiento turístico; el registro oficial de
      turismo aporta las viviendas dadas de alta ante la administración autonómica. Las familias y
      habitantes se estiman con el tamaño medio del hogar del INE (unas 2,5 personas por
      vivienda), tal y como se explica en la <a href="/metodologia">metodología</a>.
    </p>
    <p>
      Los datos vecinales los aporta la ciudadanía y no constituyen una estadística oficial:
      son una fotografía colaborativa, verificable y en construcción de lo que el alquiler
      turístico está desplazando en ${escapeHtml(name)}.
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
    withShareScript: true,
  });
}

export function renderCitiesIndex(cities: CityIndexEntry[]): string {
  const title = 'Viviendas perdidas por ciudad';
  const description =
    'Cifras de viviendas, familias y comercios desplazados por apartamentos turísticos en cada ciudad española con registros en el mapa colaborativo, incluyendo los registros oficiales de turismo de Andalucía y Cataluña.';
  const items = cities
    .map((city) => {
      const officialTotal = city.officialTotal ?? 0;
      const summary =
        officialTotal > 0
          ? `${n(city.lostDwellings)} vecinales · ${n(officialTotal)} oficiales`
          : `${n(city.lostDwellings)} viviendas · ${n(city.lostFamilies)} familias`;
      return `<li><a href="/ciudad/${escapeHtml(encodeURIComponent(city.id))}">${escapeHtml(city.name)}
          <small>${summary}</small></a></li>`;
    })
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
      Estas son las ciudades con registros en el mapa. Cada página traduce las cifras a
      impactos concretos: consumo que pierde el barrio, aulas que se vacían y presión sobre
      la vivienda.
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
