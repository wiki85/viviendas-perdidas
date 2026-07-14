import type { SearchPlace } from '../domain/types';

export const LOCAL_PLACES: SearchPlace[] = [
  {
    id: 'local-ruzafa',
    primary: 'Russafa (Ruzafa)',
    secondary: "L'Eixample, València · 46006",
    position: { lat: 39.4623, lng: -0.3734 },
    bounds: { north: 39.4687, south: 39.4549, east: -0.3634, west: -0.3836 },
    zoom: 15,
    cityId: 'valencia',
    source: 'local',
  },
  {
    id: 'local-46006',
    primary: '46006',
    secondary: 'Russafa y En Corts, València',
    position: { lat: 39.4596, lng: -0.3732 },
    zoom: 15,
    cityId: 'valencia',
    source: 'local',
  },
  {
    id: 'local-valencia',
    primary: 'València',
    secondary: 'Comunitat Valenciana',
    position: { lat: 39.4699, lng: -0.3763 },
    zoom: 12,
    cityId: 'valencia',
    source: 'local',
  },
  {
    id: 'local-madrid',
    primary: 'Madrid',
    secondary: 'Comunidad de Madrid',
    position: { lat: 40.4168, lng: -3.7038 },
    zoom: 12,
    cityId: 'madrid',
    source: 'local',
  },
  {
    id: 'local-lavapies',
    primary: 'Lavapiés',
    secondary: 'Centro, Madrid · 28012',
    position: { lat: 40.4086, lng: -3.7008 },
    zoom: 15,
    cityId: 'madrid',
    source: 'local',
  },
  {
    id: 'local-barcelona',
    primary: 'Barcelona',
    secondary: 'Catalunya',
    position: { lat: 41.3874, lng: 2.1686 },
    zoom: 12,
    cityId: 'barcelona',
    source: 'local',
  },
  {
    id: 'local-gracia',
    primary: 'Gràcia',
    secondary: 'Barcelona · 08012',
    position: { lat: 41.4036, lng: 2.1567 },
    zoom: 15,
    cityId: 'barcelona',
    source: 'local',
  },
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export function searchLocalPlaces(query: string, limit = 6) {
  const needle = normalize(query);
  if (!needle) return LOCAL_PLACES.slice(0, 3);
  return LOCAL_PLACES.filter((place) =>
    normalize(`${place.primary} ${place.secondary}`).includes(needle),
  ).slice(0, limit);
}

