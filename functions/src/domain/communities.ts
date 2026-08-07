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
    name: 'Comunidad Valenciana',
    cityIds: ['valencia', 'alicante', 'benidorm', 'torrevieja', 'calp', 'denia'],
  },
  {
    id: 'illes-balears',
    name: 'Islas Baleares',
    cityIds: [
      'palma',
      'calvia',
      'alcudia',
      'ciutadella',
      'mao',
      'sant-lluis',
      'es-mercadal',
      'alaior',
    ],
  },
  { id: 'navarra', name: 'Navarra', cityIds: ['pamplona'] },
  { id: 'euskadi', name: 'Euskadi', cityIds: ['donostia', 'bilbao'] },
  { id: 'comunidad-de-madrid', name: 'Comunidad de Madrid', cityIds: ['madrid'] },
  {
    id: 'region-de-murcia',
    name: 'Región de Murcia',
    cityIds: [
      'cartagena',
      'san-javier',
      'torre-pacheco',
      'murcia',
      'mazarron',
      'los-alcazares',
      'san-pedro-del-pinatar',
      'aguilas',
    ],
  },
  {
    id: 'galicia',
    name: 'Galicia',
    cityIds: ['vigo', 'a-coruna', 'santiago-de-compostela', 'sanxenxo', 'o-grove'],
  },
  {
    id: 'castilla-y-leon',
    name: 'Castilla y León',
    cityIds: ['leon', 'burgos', 'salamanca', 'valladolid', 'zamora', 'avila', 'soria'],
  },
  {
    id: 'aragon',
    name: 'Aragón',
    cityIds: ['zaragoza', 'jaca', 'benasque', 'sallent-de-gallego', 'panticosa', 'teruel'],
  },
  {
    id: 'castilla-la-mancha',
    name: 'Castilla-La Mancha',
    cityIds: ['toledo', 'cuenca', 'albacete'],
  },
  { id: 'extremadura', name: 'Extremadura', cityIds: ['caceres', 'merida', 'badajoz'] },
  {
    id: 'canarias',
    name: 'Canarias',
    cityIds: [
      'las-palmas-de-gran-canaria',
      'santa-cruz-de-tenerife',
      'arona',
      'adeje',
      'san-bartolome-de-tirajana',
      'mogan',
      'la-oliva',
      'yaiza',
      'tias',
    ],
  },
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
  valencia: 'Valencia',
  alicante: 'Alicante',
  benidorm: 'Benidorm',
  palma: 'Palma',
  pamplona: 'Pamplona',
  donostia: 'San Sebastián',
  bilbao: 'Bilbao',
  madrid: 'Madrid',
  torrevieja: 'Torrevieja',
  calp: 'Calpe',
  denia: 'Denia',
  calvia: 'Calvià',
  alcudia: 'Alcudia',
  girona: 'Girona',
  tarragona: 'Tarragona',
  'las-palmas-de-gran-canaria': 'Las Palmas de Gran Canaria',
  'santa-cruz-de-tenerife': 'Santa Cruz de Tenerife',
  arona: 'Arona',
  adeje: 'Adeje',
  'san-bartolome-de-tirajana': 'San Bartolomé de Tirajana',
  mogan: 'Mogán',
  'la-oliva': 'La Oliva',
  yaiza: 'Yaiza',
  tias: 'Tías',
  cartagena: 'Cartagena',
  'san-javier': 'San Javier',
  'torre-pacheco': 'Torre Pacheco',
  murcia: 'Murcia',
  mazarron: 'Mazarrón',
  'los-alcazares': 'Los Alcázares',
  'san-pedro-del-pinatar': 'San Pedro del Pinatar',
  aguilas: 'Águilas',
  ciutadella: 'Ciudadela',
  mao: 'Mahón',
  'sant-lluis': 'San Luis',
  'es-mercadal': 'Es Mercadal',
  alaior: 'Alayor',
  vigo: 'Vigo',
  'a-coruna': 'La Coruña',
  'santiago-de-compostela': 'Santiago de Compostela',
  sanxenxo: 'Sangenjo',
  'o-grove': 'El Grove',
  leon: 'León',
  burgos: 'Burgos',
  salamanca: 'Salamanca',
  valladolid: 'Valladolid',
  zamora: 'Zamora',
  avila: 'Ávila',
  soria: 'Soria',
  zaragoza: 'Zaragoza',
  jaca: 'Jaca',
  benasque: 'Benasque',
  'sallent-de-gallego': 'Sallent de Gállego',
  panticosa: 'Panticosa',
  teruel: 'Teruel',
  toledo: 'Toledo',
  cuenca: 'Cuenca',
  albacete: 'Albacete',
  caceres: 'Cáceres',
  merida: 'Mérida',
  badajoz: 'Badajoz',
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
