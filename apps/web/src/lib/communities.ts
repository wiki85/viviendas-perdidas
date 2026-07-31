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
  { id: 'cataluna', name: 'Cataluña', cityIds: ['barcelona'] },
  {
    id: 'comunitat-valenciana',
    name: 'Comunitat Valenciana',
    cityIds: ['valencia', 'alicante', 'benidorm'],
  },
  { id: 'illes-balears', name: 'Illes Balears', cityIds: ['palma'] },
  { id: 'navarra', name: 'Navarra', cityIds: ['pamplona'] },
  { id: 'euskadi', name: 'Euskadi', cityIds: ['donostia', 'bilbao'] },
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
};

export function cityDisplayName(cityId: string): string {
  return CITY_NAMES[cityId] ?? cityId;
}

export function communityForCity(cityId: string): CommunityInfo | null {
  return COMMUNITIES.find((community) => community.cityIds.includes(cityId)) ?? null;
}
