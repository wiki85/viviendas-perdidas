import { escapeHtml } from '../http/html.js';
import { cityDisplayName } from './communities.js';

/**
 * «El Recuento» — the data bulletin of Aquí Vivíamos. This module holds the
 * pure pieces: delta computation over the official history snapshots, the
 * 560px email template (system fonts only, brand palette, ▲▼= semantics
 * always with sign and number — never color alone) and the RSS rendering
 * for associations and newsrooms.
 */

export interface HistoryPoint {
  cityId: string;
  date: string;
  total: number;
}

export interface CityDelta {
  cityId: string;
  name: string;
  total: number;
  previous: number;
  delta: number;
}

const formatInt = (value: number) => value.toLocaleString('es-ES');

export function formatDeltaSigned(delta: number): string {
  if (delta > 0) return `▲ +${formatInt(delta)}`;
  if (delta < 0) return `▼ −${formatInt(Math.abs(delta))}`;
  return '= sin cambios';
}

function formatDayLong(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)));
}

/**
 * Latest total per city and the delta against the newest snapshot at or
 * before `sinceDate` (exclusive window start). Cities without any snapshot
 * in range keep their previous value with delta 0 — silence is data.
 */
export function computeCityDeltas(
  history: readonly HistoryPoint[],
  cityIds: readonly string[],
  sinceDate: string,
): CityDelta[] {
  const deltas: CityDelta[] = [];
  for (const cityId of cityIds) {
    const points = history
      .filter((point) => point.cityId === cityId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) continue;
    const latest = points[points.length - 1];
    if (latest === undefined) continue;
    const baseline = [...points].reverse().find((point) => point.date <= sinceDate) ?? points[0];
    const previous = baseline?.total ?? latest.total;
    deltas.push({
      cityId,
      name: cityDisplayName(cityId),
      total: latest.total,
      previous,
      delta: latest.total - previous,
    });
  }
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.total - a.total);
  return deltas;
}

export interface EditionScope {
  scopeLabel: string;
  deltas: CityDelta[];
}

export interface EditionInput {
  edition: 'semanal' | 'mensual';
  dateLabel: string;
  scopes: EditionScope[];
  /** Absolute URL for the CTA and links. */
  siteUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function editionSubject(input: EditionInput): string {
  const totalDelta = input.scopes
    .flatMap((scope) => scope.deltas)
    .reduce((sum, delta) => sum + delta.delta, 0);
  const head =
    totalDelta > 0
      ? `▲ +${formatInt(totalDelta)} viviendas turísticas en tus zonas`
      : totalDelta < 0
        ? `▼ ${formatInt(totalDelta)} viviendas turísticas en tus zonas`
        : 'Tus zonas, sin cambios esta edición';
  return `${head} — El Recuento, ${input.dateLabel}`;
}

/** The 560px single-column edition, three acts: what, where, one CTA. */
export function renderEditionHtml(input: EditionInput): string {
  const allDeltas = input.scopes.flatMap((scope) => scope.deltas);
  const totalDelta = allDeltas.reduce((sum, delta) => sum + delta.delta, 0);
  const maxAbs = Math.max(1, ...allDeltas.map((delta) => Math.abs(delta.delta)));
  const headline =
    totalDelta > 0
      ? `Tus zonas suman ${formatInt(totalDelta)} viviendas turísticas más`
      : totalDelta < 0
        ? `Tus zonas pierden ${formatInt(Math.abs(totalDelta))} viviendas turísticas`
        : 'Tus zonas se mantienen sin cambios';

  const scopeBlocks = input.scopes
    .map((scope) => {
      const rows = scope.deltas
        .map((delta) => {
          const cls = delta.delta > 0 ? 'up' : delta.delta < 0 ? 'dn' : 'eq';
          const color = delta.delta > 0 ? '#9b3b30' : delta.delta < 0 ? '#315d4c' : '#77837d';
          const width = Math.round((Math.abs(delta.delta) / maxAbs) * 100);
          return `
            <tr>
              <td style="padding:11px 0;border-top:1px solid rgba(30,43,39,.1);vertical-align:middle">
                <span style="font-weight:650">${escapeHtml(delta.name)}</span>
                <span style="display:block;color:#77837d;font-size:12px">${formatInt(delta.total)} registradas</span>
                <span style="display:block;height:6px;background:rgba(30,43,39,.08);border-radius:0 3px 3px 0;margin-top:5px"><span style="display:block;height:6px;width:${width}%;background:#d9604c;border-radius:0 3px 3px 0"></span></span>
              </td>
              <td class="num-${cls}" style="padding:11px 0 11px 12px;border-top:1px solid rgba(30,43,39,.1);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;color:${color};font-weight:${delta.delta === 0 ? 400 : 700}">${formatDeltaSigned(delta.delta)}</td>
            </tr>`;
        })
        .join('');
      return `
        <p style="margin:22px 0 2px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#315d4c">${escapeHtml(scope.scopeLabel)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>`;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>El Recuento</title></head>
<body style="margin:0;padding:24px 12px;background:#efe9dc">
  <div style="max-width:560px;margin:0 auto;background:#fdfbf6;color:#1e2b27;border:1px solid rgba(30,43,39,.16);border-radius:4px;overflow:hidden;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="padding:26px 30px 20px;border-bottom:3px double rgba(30,43,39,.2)">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:14px">
          <div style="width:46px;height:46px;border-radius:12px;background:#d9604c;text-align:center;line-height:46px;color:#fff;font-size:22px;font-weight:700">⌂</div>
        </td>
        <td>
          <div style="font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#315d4c">Aquí Vivíamos</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.05">El Recuento</div>
          <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#9b3b30">${escapeHtml(input.edition)} · ${escapeHtml(input.dateLabel)}</div>
        </td>
      </tr></table>
    </div>
    <div style="padding:24px 30px 8px">
      <h1 style="font-family:Georgia,serif;font-size:20px;line-height:1.25;margin:0 0 6px">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 8px;color:#4c5a54;font-size:14px">Variación en los registros oficiales de turismo desde la edición anterior.</p>
      ${scopeBlocks}
      <a href="${escapeHtml(input.siteUrl)}/estadisticas" style="display:block;text-align:center;background:#315d4c;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:999px;margin:24px 0 26px">Ver la evolución en el mapa →</a>
    </div>
    <div style="padding:18px 30px 26px;border-top:1px solid rgba(30,43,39,.12);font-size:12px;color:#77837d">
      <p style="margin:0 0 8px">Recibes El Recuento porque te suscribiste con esta dirección. <a href="${escapeHtml(input.preferencesUrl)}" style="color:#315d4c">Cambiar zonas o frecuencia</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#315d4c">Darse de baja</a> (un clic, sin preguntas).</p>
      <p style="margin:0 0 8px">Datos: registros oficiales de turismo autonómicos (CC BY 4.0; fuentes y licencias en la <a href="${escapeHtml(input.siteUrl)}/metodologia" style="color:#315d4c">metodología</a>). Ninguna administración respalda este proyecto.</p>
      <p style="margin:0">Aquí Vivíamos · aquiviviamos.com</p>
    </div>
  </div>
</body>
</html>`;
}

/* --------------------------------- RSS ------------------------------------ */

export interface FeedItem {
  guid: string;
  title: string;
  dateIso: string;
  description: string;
  link: string;
}

/** Items = every history date where the scope's carried-forward total moved. */
export function buildFeedItems(
  history: readonly HistoryPoint[],
  cityIds: readonly string[],
  scopeId: string,
  siteUrl: string,
  scopeLabel: string,
  maximum = 26,
): FeedItem[] {
  const dates = [...new Set(history.map((point) => point.date))].sort();
  const byCityDate = new Map<string, number>();
  for (const point of history) byCityDate.set(`${point.cityId}|${point.date}`, point.total);
  const lastKnown = new Map<string, number>();
  const items: FeedItem[] = [];
  let previousSum: number | null = null;
  for (const date of dates) {
    for (const cityId of cityIds) {
      const total = byCityDate.get(`${cityId}|${date}`);
      if (total !== undefined) lastKnown.set(cityId, total);
    }
    let sum = 0;
    for (const total of lastKnown.values()) sum += total;
    if (previousSum !== null && sum !== previousSum) {
      const delta = sum - previousSum;
      items.push({
        guid: `${scopeId}_${date}`,
        title: `${formatDeltaSigned(delta)} viviendas turísticas en ${scopeLabel} — ${formatDayLong(date)}`,
        dateIso: date,
        description: `${scopeLabel} pasa de ${formatInt(previousSum)} a ${formatInt(sum)} viviendas de uso turístico en los registros oficiales.`,
        link: `${siteUrl}/estadisticas`,
      });
    }
    previousSum = sum;
  }
  return items.slice(-maximum).reverse();
}

export function renderFeedXml(
  scopeLabel: string,
  feedPath: string,
  siteUrl: string,
  items: readonly FeedItem[],
): string {
  const entries = items
    .map(
      (item) => `
    <item>
      <title>${escapeHtml(item.title)}</title>
      <link>${escapeHtml(item.link)}</link>
      <guid isPermaLink="false">${escapeHtml(item.guid)}</guid>
      <pubDate>${new Date(`${item.dateIso}T09:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(item.description)}</description>
    </item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>El Recuento · ${escapeHtml(scopeLabel)}</title>
    <link>${escapeHtml(siteUrl)}/estadisticas</link>
    <atom:link href="${escapeHtml(siteUrl)}${escapeHtml(feedPath)}" rel="self" type="application/rss+xml"/>
    <description>El boletín de datos de Aquí Vivíamos: variaciones de los registros oficiales de viviendas de uso turístico. Datos CC BY 4.0 de los registros autonómicos.</description>
    <language>es</language>${entries}
  </channel>
</rss>
`;
}
