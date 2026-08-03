/** Autonomous communities of the mirrored registries. KEEP IN SYNC with
 * apps/web/src/lib/communities.ts (the web copy drives the filters UI). */
export interface CommunityInfo {
  id: string;
  name: string;
  cityIds: readonly string[];
}

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

export const CITY_NAMES: Readonly<Record<string, string>> = {
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

export const ALL_CITY_IDS: readonly string[] = COMMUNITIES.flatMap(
  (community) => community.cityIds,
);

/** 'all' | 'community:<id>' | 'city:<id>' → covered city ids (empty if unknown). */
export function cityIdsForScope(scope: string): readonly string[] {
  if (scope === 'all') return ALL_CITY_IDS;
  if (scope.startsWith('community:')) {
    return (
      COMMUNITIES.find((entry) => entry.id === scope.slice('community:'.length))?.cityIds ?? []
    );
  }
  if (scope.startsWith('city:')) {
    const id = scope.slice('city:'.length);
    return ALL_CITY_IDS.includes(id) ? [id] : [];
  }
  return [];
}

/** Human name of a subscription scope, for emails and the preferences UI. */
export function scopeDisplayName(scope: string): string {
  if (scope === 'all') return 'Toda España (ciudades cubiertas)';
  if (scope.startsWith('community:')) {
    return (
      COMMUNITIES.find((entry) => entry.id === scope.slice('community:'.length))?.name ??
      scope.slice('community:'.length)
    );
  }
  if (scope.startsWith('city:')) return cityDisplayName(scope.slice('city:'.length));
  return scope;
}
