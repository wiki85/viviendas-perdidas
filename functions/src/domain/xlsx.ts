import { inflateRawSync } from 'node:zlib';

/**
 * Lector mínimo de XLSX para los exports oficiales (Aragón): un XLSX es un
 * ZIP con hojas XML. Se resuelve sin dependencias externas leyendo el
 * directorio central del ZIP, inflando la hoja y resolviendo las cadenas
 * compartidas. Cubre celdas inline, compartidas y numéricas — suficiente
 * para tablas planas exportadas por aplicaciones de informes.
 */

interface ZipEntry {
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // End Of Central Directory: firma PK\x05\x06 buscada desde el final
  // (los últimos 64 KiB pueden ser comentario).
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_558); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd === -1) throw new Error('El fichero no es un ZIP válido.');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { compression, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipFile(buffer: Buffer, entry: ZipEntry): Buffer {
  const headerOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(headerOffset) !== 0x04034b50) {
    throw new Error('Entrada ZIP corrupta.');
  }
  const nameLength = buffer.readUInt16LE(headerOffset + 26);
  const extraLength = buffer.readUInt16LE(headerOffset + 28);
  const start = headerOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.compression === 0) return Buffer.from(raw);
  if (entry.compression === 8) return inflateRawSync(raw);
  throw new Error(`Compresión ZIP no soportada: ${entry.compression}.`);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#x([0-9a-fA-F]+);/gu, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, '&');
}

/** Texto plano de un bloque <si>/<is> (concatena los runs si los hay). */
function inlineText(xml: string): string {
  const texts = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gu)].map((match) =>
    decodeXmlEntities(match[1] ?? ''),
  );
  return texts.join('');
}

/** Columna de una referencia de celda ('BC12' → 54). */
function columnIndex(reference: string): number {
  let column = 0;
  for (const char of reference) {
    if (char < 'A' || char > 'Z') break;
    column = column * 26 + (char.charCodeAt(0) - 64);
  }
  return column - 1;
}

/** Filas de la primera hoja del XLSX como matrices de texto. */
export function parseXlsxRows(buffer: Buffer): string[][] {
  const entries = readZipEntries(buffer);
  const sheetName = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(name))
    .sort()[0];
  if (sheetName === undefined) throw new Error('El XLSX no trae hojas.');
  const sheetEntry = entries.get(sheetName);
  if (sheetEntry === undefined) throw new Error('El XLSX no trae hojas.');
  const sheetXml = readZipFile(buffer, sheetEntry).toString('utf8');

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const shared: string[] =
    sharedEntry === undefined
      ? []
      : [
          ...readZipFile(buffer, sharedEntry)
            .toString('utf8')
            .matchAll(/<si>([\s\S]*?)<\/si>/gu),
        ].map((match) => inlineText(match[1] ?? ''));

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/gu)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(
      /<c(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/c>)/gu,
    )) {
      const attributes = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const reference = /r="([A-Z]+)\d+"/u.exec(attributes)?.[1] ?? '';
      const type = /t="(\w+)"/u.exec(attributes)?.[1] ?? '';
      let value = '';
      if (type === 'inlineStr') {
        value = inlineText(body);
      } else {
        const rawValue = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1] ?? '';
        value = type === 's' ? (shared[Number(rawValue)] ?? '') : decodeXmlEntities(rawValue);
      }
      const index = reference.length > 0 ? columnIndex(reference) : row.length;
      row[index] = value.trim();
      // Rellena huecos de celdas omitidas para que los índices cuadren.
      for (let fill = 0; fill < index; fill += 1) if (row[fill] === undefined) row[fill] = '';
    }
    rows.push([...row].map((cell) => cell ?? ''));
  }
  return rows;
}
