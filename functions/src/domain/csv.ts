/**
 * Minimal RFC-4180 CSV parser (quoted fields, embedded delimiters/quotes/
 * newlines). Enough for the official open-data exports; no external
 * dependency. The GVA publishes semicolon-separated files, hence `delimiter`.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/** Header-indexed rows ('column' → value), skipping the BOM if present. */
export function parseCsvRecords(text: string, delimiter = ','): Array<Record<string, string>> {
  const rows = parseCsv(text.replace(/^\uFEFF/u, ''), delimiter);
  const header = rows[0] ?? [];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    for (let index = 0; index < header.length; index += 1) {
      record[header[index] ?? String(index)] = row[index] ?? '';
    }
    return record;
  });
}
