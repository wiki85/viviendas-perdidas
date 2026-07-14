import { afterEach, describe, expect, it, vi } from 'vitest';

describe('visible-scope point in polygon resolution', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a close zoom to the neighborhood containing the map center', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith('manifest.json')
        ? {
            cities: [
              {
                id: 'test-city',
                name: 'Ciudad de prueba',
                center: [-0.37, 39.46],
                bounds: { north: 40, south: 39, east: 0, west: -1 },
                geoJsonUrl: '/geo/test/neighborhoods.hash.geojson',
              },
            ],
          }
        : {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { id: 'centro', name: 'Centro', cityId: 'test-city' },
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[-0.5, 39.4], [-0.2, 39.4], [-0.2, 39.7], [-0.5, 39.7], [-0.5, 39.4]]],
                },
              },
            ],
          };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { resolveVisibleScope } = await import('./geo');
    const result = await resolveVisibleScope({ lat: 39.46, lng: -0.37 }, 15);
    expect(result.scope).toMatchObject({
      scopeId: 'test-city__centro',
      scope: 'neighborhood',
      name: 'Centro',
    });

    const fallback = await resolveVisibleScope(
      { lat: 37.3891, lng: -5.9845 },
      12,
      {
        id: 'sevilla',
        name: 'Sevilla',
        center: { lat: 37.3891, lng: -5.9845 },
        bounds: { north: 37.55, south: 37.23, east: -5.78, west: -6.18 },
        geoJsonUrl: '/geo/sevilla/neighborhoods.geojson',
      },
    );
    expect(fallback.scope).toMatchObject({
      scopeId: 'sevilla',
      scope: 'city',
      name: 'Sevilla',
    });
  });
});
