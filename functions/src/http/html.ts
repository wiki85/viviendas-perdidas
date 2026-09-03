/** Canonical public origin: SEO tags must not vary with the visited host. */
export const PUBLIC_ORIGIN = 'https://www.aquiviviamos.com';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

export function integer(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

/** Iconos de trazo (Lucide, ISC) para las páginas generadas en servidor. */
const ICON_PATHS = {
  basket:
    '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  school:
    '<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/><path d="M18 5v17"/><path d="m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/>',
  house:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  luggage:
    '<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function iconSvg(name: IconName, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}

/** Marca: cuatro ventanas de las que una se ha apagado (la misma que la app). */
export function brandMarkSvg(size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="#c24b36"/><rect x="7.5" y="7.5" width="7" height="7" rx="1.5" fill="#fff"/><rect x="17.5" y="7.5" width="7" height="7" rx="1.5" fill="#fff"/><rect x="7.5" y="17.5" width="7" height="7" rx="1.5" fill="#fff"/><rect x="18.25" y="18.25" width="5.5" height="5.5" rx="1.25" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 1.6" opacity="0.85"/></svg>`;
}

const LOWERCASE_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

/** 'JEREZ DE LA FRONTERA' → 'Jerez de la Frontera' for page titles. */
export function titleCaseSpanish(value: string): string {
  return value
    .toLocaleLowerCase('es')
    .split(/\s+/u)
    .map((word, index) =>
      index > 0 && LOWERCASE_CONNECTORS.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase('es') + word.slice(1),
    )
    .join(' ');
}
