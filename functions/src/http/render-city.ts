import { inhabitantsForDwellings } from '../domain/aggregates.js';
import {
  computeCityImpact,
  HOUSEHOLD_ANNUAL_SPEND_EUR,
  PUPILS_PER_CLASSROOM,
} from '../domain/city-impact.js';
import { ALL_CITY_IDS, COMMUNITIES, cityDisplayName } from '../domain/communities.js';
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
      Fuente: <a href="https://analisi.transparenciacatalunya.cat/d/t2h3-cgys" rel="noopener noreferrer">Registro de Turismo de Cataluña</a>
      (Generalitat de Catalunya, <a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies" rel="noopener noreferrer">licencia abierta de uso de información</a>),
      coordenadas del <a href="https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic" rel="noopener noreferrer">Ajuntament de Barcelona</a>
      (<a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>), datos adaptados. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'caib') {
    return `
    <p class="credit">
      Fuente: <a href="https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca" rel="noopener noreferrer">Registro de Viviendas Turísticas y Estancias Turísticas en Vivienda de Mallorca</a>
      (Consell de Mallorca, Dades Obertes GOIB), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'eus') {
    return `
    <p class="credit">
      Fuente: <a href="https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/" rel="noopener noreferrer">Registro de Empresas y Actividades Turísticas de Euskadi (REATE)</a>
      (Gobierno Vasco, Open Data Euskadi), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'mad') {
    return `
    <p class="credit">
      Fuente: <a href="https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico" rel="noopener noreferrer">Declaraciones responsables de viviendas de uso turístico</a>
      (Comunidad de Madrid), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a> ·
      coordenadas de <a href="https://www.cartociudad.es/" rel="noopener noreferrer">CartoCiudad (IGN)</a>.
      Instantánea semanal del listado vigente de declaraciones. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'can') {
    return `
    <p class="credit">
      Fuente: <a href="https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro" rel="noopener noreferrer">Registro General Turístico de Canarias (viviendas vacacionales)</a>
      (Gobierno de Canarias, datos.canarias.es), datos adaptados ·
      <a href="https://datos.canarias.es/portal/aviso-legal-y-condiciones-de-uso" rel="noopener noreferrer">reutilización con atribución</a>. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'nav') {
    return `
    <p class="credit">
      Fuente: <a href="https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra" rel="noopener noreferrer">Registro de Turismo de Navarra</a>
      (Gobierno de Navarra), datos adaptados ·
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a>. Sin respaldo oficial.
    </p>`;
  }
  if (source === 'gva') {
    return `
    <p class="credit">
      Fuente: <a href="https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51" rel="noopener noreferrer">Registro de Turismo de la Comunidad Valenciana</a>
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

/** One historic snapshot of the official register for the city. */
export interface OfficialHistoryPoint {
  date: string;
  total: number;
}

export type CityIndexEntry = CityStats & { officialTotal?: number };

export interface NeighborhoodStats {
  name: string;
  /** Viviendas del registro oficial de turismo ubicadas en el barrio. */
  officialCount: number;
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

function formatHistoryDay(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year?.slice(2) ?? ''}`;
}

/**
 * Server-rendered evolution figure: sparkline of the official total per sync
 * plus the deltas the license-growth story needs. Inline SVG (the pages' CSP
 * allows no external assets); with a single snapshot it renders the delta
 * chips and an explanatory note instead of a one-point line.
 */
export function officialEvolutionSection(
  history: OfficialHistoryPoint[],
  options: { heading?: boolean; noteHtml?: string } = {},
): string {
  if (history.length === 0) return '';
  const last = history[history.length - 1];
  const previous = history.length > 1 ? (history[history.length - 2] ?? null) : null;
  const first = history[0];
  if (last === undefined || first === undefined) return '';
  const deltaLast = previous === null ? null : last.total - previous.total;
  const deltaFirst = last.total - first.total;
  const signed = (value: number) =>
    value > 0 ? `+${n(value)}` : value < 0 ? `−${n(Math.abs(value))}` : '0';
  const chip = (value: number | null, label: string) => {
    if (value === null) return '';
    const kind = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const symbol = value > 0 ? '▲' : value < 0 ? '▼' : '=';
    return `<span class="evo-chip evo-chip--${kind}">${symbol} ${signed(value)} ${escapeHtml(label)}</span>`;
  };

  let figure = '';
  if (history.length > 1) {
    const width = 640;
    const height = 150;
    const pad = { top: 14, right: 64, bottom: 24, left: 14 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const maxTotal = Math.max(...history.map((point) => point.total));
    const minTotal = Math.min(...history.map((point) => point.total));
    const span = Math.max(1, maxTotal - minTotal);
    const x = (index: number) => pad.left + (index / (history.length - 1)) * innerW;
    const y = (value: number) => pad.top + innerH - ((value - minTotal) / span) * innerH;
    const path = history
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.total).toFixed(1)}`,
      )
      .join(' ');
    const area = `${path} L${x(history.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;
    const labelEvery = Math.max(1, Math.ceil(history.length / 6));
    const dateLabels = history
      .map((point, index) =>
        index % labelEvery === 0 || index === history.length - 1
          ? `<text x="${x(index).toFixed(1)}" y="${height - 6}" class="evo-tick" text-anchor="middle">${escapeHtml(formatHistoryDay(point.date))}</text>`
          : '',
      )
      .join('');
    figure = `
      <svg viewBox="0 0 ${width} ${height}" class="evo-chart" role="img" aria-label="Evolución del número de viviendas turísticas oficiales">
        <path d="${area}" class="evo-area"></path>
        <path d="${path}" class="evo-line"></path>
        <circle cx="${x(history.length - 1).toFixed(1)}" cy="${y(last.total).toFixed(1)}" r="5" class="evo-dot"></circle>
        <text x="${(x(history.length - 1) + 10).toFixed(1)}" y="${(y(last.total) + 4).toFixed(1)}" class="evo-endlabel">${n(last.total)}</text>
        ${dateLabels}
      </svg>`;
  }

  const note =
    options.noteHtml ??
    'Instantáneas semanales del registro oficial de turismo. <a href="/estadisticas">Ver estadísticas de todas las ciudades</a>.';
  return `
    ${options.heading === false ? '' : '<h2>Evolución del registro oficial</h2>'}
    <div class="evo">
      <div class="evo-chips">
        ${chip(deltaLast, 'desde la sincronización anterior')}
        ${history.length > 1 ? chip(deltaFirst, `desde el ${formatHistoryDay(first.date)}`) : ''}
        ${history.length === 1 ? `<span class="evo-chip evo-chip--flat">Primer registro del histórico: ${n(first.total)} viviendas (${formatHistoryDay(first.date)})</span>` : ''}
      </div>
      ${figure}
      <p class="evo-note">${note}</p>
    </div>`;
}

export const SHARED_CSS = `
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
  .evo{background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px;padding:14px 16px;margin:6px 0 22px}
  .evo-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
  .evo-chip{display:inline-flex;align-items:center;gap:5px;font-size:.82rem;font-weight:700;border-radius:999px;padding:4px 11px;font-variant-numeric:tabular-nums}
  .evo-chip--up{background:rgba(155,59,48,.1);color:#9b3b30}
  .evo-chip--down{background:rgba(31,107,70,.1);color:#1f6b46}
  .evo-chip--flat{background:rgba(30,43,39,.06);color:#3c4a44;font-weight:600}
  .evo-chart{width:100%;height:auto;display:block}
  .evo-line{fill:none;stroke:#d9604c;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
  .evo-area{fill:rgba(217,96,76,.1)}
  .evo-dot{fill:#d9604c;stroke:#fff;stroke-width:2}
  .evo-endlabel{font-size:12px;font-weight:700;fill:#1e2b27}
  .evo-tick{font-size:10px;fill:#65716c}
  .evo-note{font-size:.78rem;color:#65716c;margin:8px 0 0}
  .evo-note a{color:#315d4c}
  code{background:rgba(30,43,39,.07);border-radius:6px;padding:2px 7px;font-size:.85em;word-break:break-all}
  .src-card{background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px;padding:16px 18px;margin:6px 0 24px}
  .src-card .stats{margin:12px 0 0}
  .src-card .stat{background:#f7f3eb;border-color:rgba(30,43,39,.08)}
  .src-totals .stat strong{color:#9b3b30}
  .src-note{font-size:.85rem;color:#65716c;margin:10px 0 0}
  .src-toggles{display:flex;flex-wrap:wrap;gap:8px}
  .src-toggles button{font:inherit;font-size:.82rem;font-weight:700;padding:7px 14px;border-radius:999px;border:1px solid rgba(49,93,76,.3);background:rgba(49,93,76,.12);color:#24463a;cursor:pointer}
  .src-toggles button[aria-pressed="false"]{background:transparent;color:#77837d;border-color:rgba(30,43,39,.18);text-decoration:line-through}
  .src-card [data-source-detail][hidden]{display:none}
  .src-card .credit{margin:10px 0 0}
  .barrios-scroll{max-height:660px;overflow-y:auto;background:#fff;border:1px solid rgba(30,43,39,.12);border-radius:14px}
  .barrios-scroll table{border:0;border-radius:0}
  .barrios-scroll thead th{position:sticky;top:0;background:#eef3f0;z-index:1}
  .sub-strip{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:rgba(49,93,76,.09);border:1px solid rgba(49,93,76,.25);border-radius:12px;padding:10px 14px;margin:14px 0 4px;font-size:.9rem}
  .sub-strip p{margin:0;flex:1;min-width:200px;color:#24463a}
  .sub-strip a{flex-shrink:0;display:inline-block;background:#315d4c;color:#fff;text-decoration:none;font-weight:700;padding:9px 16px;border-radius:999px;font-size:.85rem}
  .sub-box{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;background:rgba(49,93,76,.09);border:1px solid rgba(49,93,76,.25);border-radius:14px;padding:16px 20px;margin:26px 0 0}
  .sub-box h2{margin:0 0 4px;font-size:1.1rem}
  .sub-box p{margin:0;font-size:.9rem;max-width:52ch}
  .sub-box a{flex-shrink:0;display:inline-block;background:#315d4c;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px}
  .embed-row{display:flex;gap:10px;align-items:center;margin:10px 0}
  .embed-row code{flex:1;min-width:0;display:block;background:#fff;border:1px solid rgba(30,43,39,.14);border-radius:10px;padding:9px 12px;font-size:.72rem;overflow-x:auto;white-space:nowrap}
  .embed-row button{flex-shrink:0;font:inherit;font-size:.86rem;font-weight:700;color:#fff;background:#315d4c;border:0;border-radius:999px;padding:9px 16px;cursor:pointer}
  @media (max-width:640px){.embed-row{flex-direction:column;align-items:stretch}}
`;

const SHARE_SCRIPT = `
(function(){
  var sourceToggles=Array.prototype.slice.call(document.querySelectorAll('[data-toggle-source]'));
  function pressed(name){
    var toggle=sourceToggles.find(function(t){return t.getAttribute('data-toggle-source')===name;});
    return toggle?toggle.getAttribute('aria-pressed')==='true':false;
  }
  function applySources(){
    var oficial=pressed('oficial');
    var vecinal=pressed('vecinal');
    var key=oficial&&vecinal?'ambas':oficial?'oficial':'vecinal';
    document.querySelectorAll('[data-dynamic]').forEach(function(el){
      var value=el.getAttribute('data-'+key);
      if(value!==null)el.textContent=value;
    });
    document.querySelectorAll('[data-source-detail]').forEach(function(el){
      if(pressed(el.getAttribute('data-source-detail')))el.removeAttribute('hidden');
      else el.setAttribute('hidden','');
    });
  }
  sourceToggles.forEach(function(toggle){
    toggle.addEventListener('click',function(){
      var on=toggle.getAttribute('aria-pressed')==='true';
      if(on){
        // Al menos una fuente siempre activa.
        var otherOn=sourceToggles.some(function(t){return t!==toggle&&t.getAttribute('aria-pressed')==='true';});
        if(!otherOn)return;
      }
      toggle.setAttribute('aria-pressed',on?'false':'true');
      applySources();
    });
  });
  document.querySelectorAll('[data-copy-target]').forEach(function(copyButton){
    copyButton.addEventListener('click',function(){
      var code=document.getElementById(copyButton.getAttribute('data-copy-target'));
      if(!code||!navigator.clipboard)return;
      navigator.clipboard.writeText(code.textContent||'').then(function(){
        var original=copyButton.textContent;
        copyButton.textContent='¡Copiado!';
        setTimeout(function(){copyButton.textContent=original;},2000);
      });
    });
  });
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

export function pageShell(options: {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: unknown;
  body: string;
  withShareScript?: boolean;
  /** RSS autodiscovery: absolute feed path ('/feeds/sevilla.xml'). */
  feedPath?: string;
  feedTitle?: string;
}): string {
  const canonicalUrl = `${PUBLIC_ORIGIN}${options.canonicalPath}`;
  const feedLink = options.feedPath
    ? `\n    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(options.feedTitle ?? 'El Recuento')}" href="${escapeHtml(options.feedPath)}">`
    : '';
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
    <script type="application/ld+json">${jsonForInlineScript(options.jsonLd)}</script>${feedLink}
    <style>${SHARED_CSS}</style>
  </head>
  <body>
    <header class="site">
      <a href="/"><img src="/icons/icon-192.png" width="22" height="22" alt="" style="vertical-align:-4px;border-radius:6px"> Viviendas Perdidas</a>
    </header>
    <main>${options.body}</main>
    <footer>
      Proyecto ciudadano independiente y sin ánimo de lucro. Datos colaborativos y no oficiales.
      <a href="/metodologia">Metodología</a> · <a href="/acerca">Acerca del proyecto</a> ·
      <a href="/ciudades">Datos por ciudad</a> · <a href="/prensa">Prensa y feeds</a> ·
      <a href="/fuentes">Fuentes</a>
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
  history: OfficialHistoryPoint[] = [],
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
    ? `<p class="updated">Actualizado el ${escapeHtml(dateFormatter.format(updatedAt))}</p>`
    : '';

  const communityGrid = `
    <div class="stats">
      <div class="stat"><strong>${n(city.lostDwellings)}</strong><span>viviendas perdidas</span></div>
      <div class="stat"><strong>${n(city.lostFamilies)}</strong><span>familias desplazadas</span></div>
      <div class="stat"><strong>${n(city.lostInhabitants)}</strong><span>habitantes desplazados</span></div>
      <div class="stat"><strong>${n(city.lostCommercial)}</strong><span>comercios convertidos</span></div>
    </div>`;

  // Sin registro oficial la página conserva la caja vecinal simple. Con él,
  // una única fila de números: los botones eligen la fuente (oficial,
  // vecinal o ambas) y las cifras cambian dinámicamente. Sin JavaScript se
  // muestran los totales combinados.
  const communitySection = official ? '' : communityGrid;
  const officialInhabitants = inhabitants - city.lostInhabitants;
  const dyn = (ambas: string, oficial: string, vecinal: string) =>
    `data-dynamic data-ambas="${escapeHtml(ambas)}" data-oficial="${escapeHtml(oficial)}" data-vecinal="${escapeHtml(vecinal)}"`;
  const officialSection = official
    ? `
    <h2>Viviendas dedicadas al turismo</h2>
    <div class="src-card">
      <div class="src-toggles" role="group" aria-label="Elegir las fuentes que suman">
        <button type="button" data-toggle-source="oficial" aria-pressed="true">Registro oficial de turismo (${n(official.total)})</button>
        <button type="button" data-toggle-source="vecinal" aria-pressed="true">Registros vecinales (${n(city.lostDwellings)})</button>
      </div>
      <div class="stats src-totals">
        <div class="stat"><strong ${dyn(n(totalDwellings), n(official.total), n(city.lostDwellings))}>${n(totalDwellings)}</strong><span>viviendas en alquiler turístico</span></div>
        <div class="stat"><strong ${dyn(n(households), n(officialEntire), n(city.lostFamilies))}>${n(households)}</strong><span>hogares que ya no pueden vivir ahí</span></div>
        <div class="stat"><strong ${dyn(n(inhabitants), n(officialInhabitants), n(city.lostInhabitants))}>${n(inhabitants)}</strong><span>personas desplazadas</span></div>
        <div class="stat"><strong ${dyn(n(official.places), n(official.places), '—')}>${n(official.places)}</strong><span>plazas turísticas oficiales</span></div>
      </div>
      <p class="src-note" ${dyn(
        'Suma del registro oficial de turismo y de los registros vecinales de este mapa. Las viviendas «solo por habitaciones» no se cuentan como hogar desplazado.',
        `Solo el registro oficial: ${n(officialEntire)} viviendas completas y ${n(official.roomsOnly)} «solo por habitaciones» (estas no cuentan como hogar desplazado).`,
        'Solo los registros vecinales aportados por la ciudadanía en este mapa, verificables y en construcción.',
      )}>Suma del registro oficial de turismo y de los registros vecinales de este mapa. Las viviendas «solo por habitaciones» no se cuentan como hogar desplazado.</p>
      <div data-source-detail="oficial">
        ${officialCredit(official.source)}
      </div>
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
        `<tr><td>${escapeHtml(entry.name)}</td><td class="num">${n(entry.officialCount)}</td><td class="num">${n(entry.lostDwellings)}</td><td class="num">${n(entry.lostCommercial)}</td></tr>`,
    )
    .join('');
  const neighborhoodsSection =
    neighborhoods.length > 0
      ? `<h2>Desglose por barrios</h2>
        <div class="barrios-scroll">
        <table>
          <thead><tr><th>Barrio</th><th class="num">Registro oficial</th><th class="num">Vecinales</th><th class="num">Locales</th></tr></thead>
          <tbody>${neighborhoodRows}</tbody>
        </table>
        </div>`
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
  const covered = ALL_CITY_IDS.includes(city.id);
  const subscribeStrip = covered
    ? `
    <div class="sub-strip">
      <p><strong>El Recuento</strong>: recibe en tu correo cada subida o bajada del registro
      de ${escapeHtml(name)} — semanal o mensual, y solo si hay cambios.</p>
      <a href="/boletin">Suscribirse gratis</a>
    </div>`
    : '';
  const subscribeBox = covered
    ? `
    <div class="sub-box">
      <div>
        <h2>El Recuento: estas cifras, en tu correo</h2>
        <p>
          Cada semana o cada mes, las variaciones de ${escapeHtml(name)} y de las zonas que
          elijas — y solo si hay cambios. También hay feeds RSS por ciudad.
        </p>
      </div>
      <a href="/boletin">Suscribirse gratis</a>
    </div>`
    : '';
  const followSection = covered
    ? `
    <h2>Sigue los datos de ${escapeHtml(name)}</h2>
    <p>
      Para redacciones, asociaciones y lectores RSS existe un
      <a href="/feeds/${escapeHtml(city.id)}.xml">feed RSS de ${escapeHtml(name)}</a> con cada
      variación del recuento oficial, listo para citar o automatizar
      (<a href="/prensa">cómo usarlo</a>).
    </p>
    <p>
      ¿Tienes una web? Inserta la gráfica de ${escapeHtml(name)} con este código; se actualiza
      sola con cada sincronización:
    </p>
    <div class="embed-row">
      <code id="embed-code">&lt;iframe src="${PUBLIC_ORIGIN}/embed/${escapeHtml(city.id)}/evolucion" title="Viviendas turísticas registradas — ${escapeHtml(name)}" width="100%" height="420" style="border:0;max-width:720px" loading="lazy"&gt;&lt;/iframe&gt;</code>
      <button type="button" data-copy-target="embed-code">Copiar código</button>
    </div>`
    : '';
  const body = `
    <h1>Viviendas perdidas en ${escapeHtml(name)}</h1>
    ${updatedLine}
    ${subscribeStrip}
    ${communitySection}
    ${officialSection}
    ${official ? officialEvolutionSection(history) : ''}
    <a class="cta" href="/?${escapeHtml(mapQuery)}">Ver ${escapeHtml(name)} en el mapa</a>
    ${impactSection}
    ${followSection}
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
    </div>
    ${subscribeBox}`;
  return pageShell({
    title,
    description,
    canonicalPath: `/ciudad/${city.id}`,
    jsonLd,
    body,
    withShareScript: true,
    ...(covered ? { feedPath: `/feeds/${city.id}.xml`, feedTitle: `El Recuento · ${name}` } : {}),
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
  const staticEntries = ['/', '/ciudades', '/metodologia', '/acerca', '/prensa', '/fuentes'].map(
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

/** /prensa — the door for newsrooms and associations: feeds, data, reuse. */
export function renderPressPage(): string {
  const feedRows = COMMUNITIES.flatMap((community) =>
    community.cityIds.map(
      (cityId) => `
        <tr>
          <td>${escapeHtml(cityDisplayName(cityId))}<br><small style="color:#65716c">${escapeHtml(community.name)}</small></td>
          <td><code>${escapeHtml(`${PUBLIC_ORIGIN}/feeds/${cityId}.xml`)}</code></td>
          <td><a href="/ciudad/${escapeHtml(cityId)}">página</a></td>
        </tr>`,
    ),
  ).join('');

  const body = `
    <h1>Prensa y reutilización de datos</h1>
    <p>
      <strong>Viviendas Perdidas</strong> (aquiviviamos.com) documenta la conversión de viviendas
      en alojamientos turísticos en España combinando los registros oficiales de turismo
      autonómicos —más de 80.000 viviendas georreferenciadas en 19 ciudades— con aportaciones
      vecinales verificables. Todo lo que hay aquí se puede citar, enlazar y reutilizar.
    </p>

    <h2>El Recuento: un feed RSS por ciudad</h2>
    <p>
      Cada vez que una sincronización semanal detecta que el registro oficial de una ciudad suma o
      retira viviendas turísticas, su feed publica una entrada con la cifra exacta («▲ +34
      viviendas turísticas en Sevilla») y los totales antes y después. Sin cambios no hay entrada:
      cero ruido.
    </p>
    <p>
      Feed de toda España: <code>${escapeHtml(`${PUBLIC_ORIGIN}/feeds/todo.xml`)}</code>
    </p>
    <table>
      <thead><tr><th>Ciudad</th><th>Feed RSS</th><th></th></tr></thead>
      <tbody>${feedRows}
      </tbody>
    </table>

    <h2>Cómo usar los feeds</h2>
    <p>
      <strong>En un lector RSS</strong> (Feedly, Inoreader, NetNewsWire…): añade la URL del feed
      tal cual. Las páginas de ciudad también anuncian su feed automáticamente, así que basta con
      pegar la dirección de la página.
    </p>
    <p>
      <strong>En una web o un CMS</strong>: cualquier módulo de RSS sirve — en WordPress, el
      bloque «RSS» con la URL del feed muestra las últimas variaciones en tu página; en otros
      gestores, cualquier widget o plugin equivalente.
    </p>
    <p>
      <strong>Para alertas y automatizaciones</strong>: servicios como Zapier, Make o IFTTT pueden
      vigilar el feed y avisarte por correo, Slack o Telegram cuando haya una entrada nueva de tu
      ciudad. Cada entrada tiene un identificador estable (<code>ciudad_AAAA-MM-DD</code>), así
      que no verás duplicados.
    </p>

    <h2>Inserta las gráficas en tu web</h2>
    <p>
      Cada gráfica y cada juego de cifras se puede incrustar en cualquier página con un iframe:
      se actualiza solo con cada sincronización y lleva la fuente citada. Dos formatos por ámbito:
      <code>/embed/&lt;ámbito&gt;/evolucion</code> (gráfica, alto recomendado 420) y
      <code>/embed/&lt;ámbito&gt;/cifras</code> (totales y variaciones, alto 230). El ámbito es
      <code>todo</code>, el identificador de una comunidad (<code>andalucia</code>,
      <code>euskadi</code>…) o el de una ciudad (<code>sevilla</code>, <code>bilbao</code>…).
    </p>
    <div class="embed-row">
      <code id="embed-ejemplo">&lt;iframe src="${PUBLIC_ORIGIN}/embed/todo/evolucion" title="Viviendas turísticas registradas en España" width="100%" height="420" style="border:0;max-width:720px" loading="lazy"&gt;&lt;/iframe&gt;</code>
      <button type="button" data-copy-target="embed-ejemplo">Copiar ejemplo</button>
    </div>
    <p>
      En la <a href="/estadisticas">página de estadísticas</a> y en cada página de ciudad hay un
      botón «Copiar código» que genera el iframe exacto de lo que estés viendo.
    </p>

    <h2>Boletín por correo</h2>
    <p>
      Si prefieres el correo, <a href="/boletin">El Recuento</a> envía las variaciones de las
      zonas que elijas (ciudad, comunidad o toda España), cada semana o cada mes — y la edición
      semanal solo sale si hubo cambios.
    </p>

    <h2>Datos y cifras citables</h2>
    <p>
      La <a href="/estadisticas">página de estadísticas</a> muestra la evolución del recuento
      oficial con filtros por ciudad y comunidad; cada <a href="/ciudades">página de ciudad</a>
      incluye sus cifras y su gráfica; y los registros vecinales se pueden
      <a href="/datos">descargar en JSON</a>.
    </p>

    <h2>Cómo citarnos</h2>
    <p>
      Los datos oficiales proceden de los registros de turismo autonómicos (licencias CC BY 4.0 y
      equivalentes; el detalle por fuente, con enlaces, problemas conocidos y un ranking de
      transparencia, está en la <a href="/fuentes">página de fuentes</a>). Una
      fórmula que funciona: <em>«Datos de los registros oficiales de turismo autonómicos,
      recopilados por Viviendas Perdidas (aquiviviamos.com)»</em>, con enlace. Ninguna
      administración respalda este proyecto.
    </p>

    <div class="note">
      ¿Necesitas un corte de datos concreto, una entrevista o contexto para una pieza? Escríbenos
      desde el formulario de contacto del <a href="/">mapa</a> (icono del sobre, arriba a la
      derecha) y te respondemos en cuanto podamos.
    </div>`;

  return pageShell({
    title: 'Prensa y feeds RSS — Viviendas Perdidas',
    description:
      'Feeds RSS por ciudad, boletín de datos y cifras citables sobre viviendas turísticas en España: cómo usarlos y cómo citarnos.',
    canonicalPath: '/prensa',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Prensa y feeds RSS — Viviendas Perdidas',
      inLanguage: 'es',
      isAccessibleForFree: true,
    },
    body,
    withShareScript: true,
    feedPath: '/feeds/todo.xml',
    feedTitle: 'El Recuento · España',
  });
}
