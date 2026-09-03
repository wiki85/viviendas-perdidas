import type { Listing, ListingType } from '../domain/types';

/** Silueta del pin (36×46): círculo de radio 15,5 con punta en (18, 44,5). */
export const PIN_OUTLINE =
  'M18 44.5C18 44.5 33.5 26.5 33.5 17A15.5 15.5 0 1 0 2.5 17C2.5 26.5 18 44.5 18 44.5Z';

/** Glifos de 24×24 (trazo, sin relleno) para cada tipo de inmueble. */
export const GLYPH_PATHS: Record<ListingType, string> = {
  unit:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' +
    '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  building:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>' +
    '<path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>' +
    '<path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>' +
    '<path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  commercial:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>' +
    '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
    '<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>' +
    '<path d="M2 7h20"/>' +
    '<path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
};

/** Transformación que centra el glifo de 24 px (a 18 px) en el círculo del pin. */
export const GLYPH_TRANSFORM = 'translate(9 8) scale(0.75)';

/** SVG del pin como cadena, para los marcadores del mapa real (DOM manual). */
export function pinSvg(type: ListingType): string {
  return (
    '<svg viewBox="0 0 36 46" aria-hidden="true" focusable="false">' +
    `<path class="pin__shape" d="${PIN_OUTLINE}"/>` +
    `<g class="pin__glyph" transform="${GLYPH_TRANSFORM}">${GLYPH_PATHS[type]}</g>` +
    '</svg>'
  );
}

export function pinClassName(listing: Pick<Listing, 'type' | 'status'>, selected = false): string {
  return [
    'pin',
    `pin--${listing.type}`,
    listing.status === 'flagged' ? 'pin--flagged' : '',
    selected ? 'pin--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function pinAriaLabel(listing: Listing): string {
  if (listing.type === 'commercial') {
    return `Local comercial convertido, ${listing.address.formatted}`;
  }
  const kind = listing.type === 'building' ? 'Edificio completo o parcial' : 'Apartamento';
  const homes = `${listing.dwellingsCount} ${listing.dwellingsCount === 1 ? 'vivienda' : 'viviendas'}`;
  return `${kind}, ${homes}, ${listing.address.formatted}`;
}
