const DIACRITICS = /\p{Diacritic}/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

const STREET_PREFIXES: Readonly<Record<string, string>> = {
  av: 'avenida',
  avda: 'avenida',
  avenida: 'avenida',
  c: 'calle',
  cl: 'calle',
  calle: 'calle',
  p: 'paseo',
  paseo: 'paseo',
  pl: 'plaza',
  plaza: 'plaza',
  rd: 'ronda',
  ronda: 'ronda',
};

export function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLocaleLowerCase('es')
    .replace(NON_ALPHANUMERIC, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeStreet(value: string): string {
  const parts = normalizeComparable(value).split(' ').filter(Boolean);
  const first = parts[0];
  if (first !== undefined && STREET_PREFIXES[first] !== undefined) {
    parts[0] = STREET_PREFIXES[first];
  }
  return parts.join(' ');
}

export function normalizeStreetNumber(value: string): string {
  return normalizeComparable(value).replace(/\s+/g, '');
}

export function slugifyCity(value: string): string {
  const slug = normalizeComparable(value).replace(/\s+/g, '-');
  if (slug === 'valencia' || slug === 'valencia valencia') return 'valencia';
  return slug;
}
