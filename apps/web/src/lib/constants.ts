import type { CityDefinition, LatLng } from '../domain/types';

export const HOUSEHOLD_SIZE = 2.5;
export const NEIGHBORHOOD_ZOOM = 14;
export const MAX_LISTINGS_PER_VIEW = 500;
export const MAX_OFFICIAL_PINS = 400;
export const SPAIN_CENTER: LatLng = { lat: 40.2085, lng: -3.713 };
export const SPAIN_ZOOM = 5.6;

export const FALLBACK_CITIES: CityDefinition[] = [
  {
    id: 'madrid',
    name: 'Madrid',
    center: { lat: 40.4168, lng: -3.7038 },
    bounds: { north: 40.5638, south: 40.3121, east: -3.5249, west: -3.8889 },
    geoJsonUrl: '/geo/madrid/neighborhoods.geojson',
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    center: { lat: 41.3874, lng: 2.1686 },
    bounds: { north: 41.4696, south: 41.3201, east: 2.2284, west: 2.0525 },
    geoJsonUrl: '/geo/barcelona/neighborhoods.geojson',
  },
  {
    id: 'valencia',
    name: 'València',
    center: { lat: 39.4699, lng: -0.3763 },
    bounds: { north: 39.5906, south: 39.275, east: -0.2724, west: -0.4316 },
    geoJsonUrl: '/geo/valencia/neighborhoods.geojson',
  },
];

export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f3efe6' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9ded9' }] },
];

export const EMPTY_SCOPE = {
  scopeId: 'spain',
  scope: 'country' as const,
  cityId: null,
  neighborhoodId: null,
  name: 'España',
};
