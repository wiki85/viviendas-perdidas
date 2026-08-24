/**
 * Helpers para los registros que sirven una tabla HTML disfrazada de Excel
 * (el ITREM murciano y el portal del Consell d'Eivissa): filas a celdas de
 * texto plano con las entidades HTML decodificadas.
 */

/** Entidades HTML con nombre que sirven estos portales. La cabecera de
 * dirección del ITREM llega como «DIRECCI&Oacute;N» (visto en agosto de
 * 2026): decodificarlas antes de la regla genérica evita perder columnas en
 * silencio y quedarnos con miles de filas sin dirección. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  Aacute: 'Á',
  aacute: 'á',
  Eacute: 'É',
  eacute: 'é',
  Iacute: 'Í',
  iacute: 'í',
  Oacute: 'Ó',
  oacute: 'ó',
  Uacute: 'Ú',
  uacute: 'ú',
  Ntilde: 'Ñ',
  ntilde: 'ñ',
  Uuml: 'Ü',
  uuml: 'ü',
  Agrave: 'À',
  agrave: 'à',
  Egrave: 'È',
  egrave: 'è',
  Ograve: 'Ò',
  ograve: 'ò',
  Ccedil: 'Ç',
  ccedil: 'ç',
  ordm: 'º',
  ordf: 'ª',
};

export function stripTags(cell: string): string {
  return cell
    .replace(/<[^>]+>/gu, '')
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(\w+);/gu, (_match, name: string) => NAMED_ENTITIES[name] ?? ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Filas de la tabla HTML como celdas de texto plano. */
export function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...(rowMatch[1] ?? '').matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gu)].map(
      (cell) => stripTags(cell[1] ?? ''),
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}
