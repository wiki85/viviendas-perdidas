/** Autonomous communities of the mirrored official registries, for the
 * statistics filters. KEEP IN SYNC with the sources in official-sync.ts. */
export type CommunityInfo = {
  id: string;
  name: string;
  cityIds: readonly string[];
};

export const COMMUNITIES: readonly CommunityInfo[] = [
  {
    id: 'andalucia',
    name: 'Andalucía',
    cityIds: [
      'sevilla',
      'malaga',
      'granada',
      'cordoba',
      'cadiz',
      'huelva',
      'jaen',
      'almeria',
      'jerez-de-la-frontera',
      'marbella',
    ],
  },
  { id: 'cataluna', name: 'Cataluña', cityIds: ['barcelona', 'girona', 'tarragona'] },
  {
    id: 'comunitat-valenciana',
    name: 'Comunitat Valenciana',
    cityIds: ['valencia', 'alicante', 'benidorm', 'torrevieja', 'calp', 'denia'],
  },
  { id: 'illes-balears', name: 'Illes Balears', cityIds: ['palma', 'calvia', 'alcudia'] },
  { id: 'navarra', name: 'Navarra', cityIds: ['pamplona'] },
  { id: 'euskadi', name: 'Euskadi', cityIds: ['donostia', 'bilbao'] },
  { id: 'comunidad-de-madrid', name: 'Comunidad de Madrid', cityIds: ['madrid'] },
];

const CITY_NAMES: Readonly<Record<string, string>> = {
  sevilla: 'Sevilla',
  malaga: 'Málaga',
  granada: 'Granada',
  cordoba: 'Córdoba',
  cadiz: 'Cádiz',
  huelva: 'Huelva',
  jaen: 'Jaén',
  almeria: 'Almería',
  'jerez-de-la-frontera': 'Jerez de la Frontera',
  marbella: 'Marbella',
  barcelona: 'Barcelona',
  valencia: 'València',
  alicante: 'Alicante',
  benidorm: 'Benidorm',
  palma: 'Palma',
  pamplona: 'Pamplona',
  donostia: 'Donostia / San Sebastián',
  bilbao: 'Bilbao',
  madrid: 'Madrid',
  torrevieja: 'Torrevieja',
  calp: 'Calp',
  denia: 'Dénia',
  calvia: 'Calvià',
  alcudia: 'Alcúdia',
  girona: 'Girona',
  tarragona: 'Tarragona',
};

export function cityDisplayName(cityId: string): string {
  return CITY_NAMES[cityId] ?? cityId;
}

/** Center + plausible municipal radius per covered city — lets the map know
 * it is over a covered city without any geocoding call. KEEP IN SYNC with
 * MUNICIPALITY_CENTERS in functions/src/domain/openrta.ts. */
export const CITY_CENTERS: Readonly<
  Record<string, { lat: number; lng: number; radiusKm: number }>
> = {
  sevilla: { lat: 37.3891, lng: -5.9845, radiusKm: 30 },
  malaga: { lat: 36.7213, lng: -4.4214, radiusKm: 30 },
  granada: { lat: 37.1773, lng: -3.5986, radiusKm: 25 },
  cordoba: { lat: 37.8882, lng: -4.7794, radiusKm: 45 },
  cadiz: { lat: 36.5297, lng: -6.2927, radiusKm: 20 },
  huelva: { lat: 37.2614, lng: -6.9447, radiusKm: 25 },
  jaen: { lat: 37.7796, lng: -3.7849, radiusKm: 30 },
  almeria: { lat: 36.834, lng: -2.4637, radiusKm: 35 },
  'jerez-de-la-frontera': { lat: 36.6866, lng: -6.1372, radiusKm: 45 },
  marbella: { lat: 36.5101, lng: -4.8825, radiusKm: 30 },
  barcelona: { lat: 41.3874, lng: 2.1686, radiusKm: 20 },
  valencia: { lat: 39.4699, lng: -0.3763, radiusKm: 22 },
  alicante: { lat: 38.3452, lng: -0.481, radiusKm: 22 },
  benidorm: { lat: 38.5382, lng: -0.131, radiusKm: 12 },
  palma: { lat: 39.5696, lng: 2.6502, radiusKm: 22 },
  pamplona: { lat: 42.8125, lng: -1.644, radiusKm: 12 },
  donostia: { lat: 43.3183, lng: -1.9812, radiusKm: 12 },
  bilbao: { lat: 43.263, lng: -2.935, radiusKm: 12 },
  madrid: { lat: 40.4168, lng: -3.7038, radiusKm: 25 },
  torrevieja: { lat: 37.9787, lng: -0.6822, radiusKm: 15 },
  calp: { lat: 38.6446, lng: 0.0453, radiusKm: 10 },
  denia: { lat: 38.8408, lng: 0.1057, radiusKm: 15 },
  calvia: { lat: 39.5657, lng: 2.5062, radiusKm: 18 },
  alcudia: { lat: 39.8499, lng: 3.124, radiusKm: 12 },
  girona: { lat: 41.9794, lng: 2.8214, radiusKm: 12 },
  tarragona: { lat: 41.1189, lng: 1.2445, radiusKm: 15 },
};

/** Covered city under the map center at city-level zoom, or null. */
export function coveredCityForPosition(
  position: { lat: number; lng: number },
  zoom: number,
  distanceMeters: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
): string | null {
  if (zoom < 11) return null;
  let best: { id: string; distance: number } | null = null;
  for (const [id, center] of Object.entries(CITY_CENTERS)) {
    const distance = distanceMeters(position, { lat: center.lat, lng: center.lng });
    if (distance <= center.radiusKm * 1000 && (best === null || distance < best.distance)) {
      best = { id, distance };
    }
  }
  return best?.id ?? null;
}

export function communityForCity(cityId: string): CommunityInfo | null {
  return COMMUNITIES.find((community) => community.cityIds.includes(cityId)) ?? null;
}
