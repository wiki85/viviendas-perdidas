import { describe, expect, it } from 'vitest';
import {
  renderCitiesIndex,
  renderCityPage,
  renderSitemap,
  type CityStats,
  type OfficialCityStats,
} from './render-city.js';

function city(overrides: Partial<CityStats> = {}): CityStats {
  return {
    id: 'valencia',
    name: 'València',
    listingsCount: 12,
    lostDwellings: 34,
    lostFamilies: 34,
    lostInhabitants: 85,
    lostCommercial: 3,
    updatedAt: new Date('2026-07-15T10:00:00Z'),
    ...overrides,
  };
}

describe('renderCityPage', () => {
  it('renders the city figures, canonical URL and map deep link', () => {
    const html = renderCityPage(city(), [
      { name: 'Russafa', lostDwellings: 20, lostFamilies: 20, lostCommercial: 1 },
    ]);
    expect(html).toContain('Viviendas perdidas en València');
    expect(html).toContain('<strong>34</strong>');
    expect(html).toContain('<strong>85</strong>');
    expect(html).toContain('href="https://www.aquiviviamos.com/ciudad/valencia"');
    expect(html).toContain('href="/?scope=valencia"');
    expect(html).toContain('Russafa');
    expect(html).toContain('"@type":"Dataset"');
  });

  it('escapes HTML in names coming from the database', () => {
    const html = renderCityPage(city({ name: '<script>alert(1)</script>' }), []);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits the neighbourhood table when there is no breakdown', () => {
    const html = renderCityPage(city(), []);
    expect(html).not.toContain('Desglose por barrios');
  });

  it('translates households into sourced impact estimates and share links', () => {
    const html = renderCityPage(city(), []);
    // 34 hogares × 34.044 € ≈ 1,2 millones de € al año.
    expect(html).toContain('1,2 millones de €');
    expect(html).toContain('aulas escolares');
    expect(html).toContain('https://www.ine.es/dyngs/Prensa/EPF2024.htm');
    expect(html).toContain('https://wa.me/?text=');
    expect(html).toContain('twitter.com/intent/tweet');
    expect(html).toContain('data-share-url="https://www.aquiviviamos.com/ciudad/valencia"');
  });

  it('adds the official registry, combined totals and housing-stock pressure', () => {
    const official: OfficialCityStats = {
      total: 9578,
      entireHomes: 8876,
      roomsOnly: 702,
      roomsInhabitants: 1050,
      places: 40000,
      source: 'openrta',
      updatedAt: new Date('2026-07-20T04:30:00Z'),
    };
    const html = renderCityPage(city({ id: 'sevilla', name: 'Sevilla' }), [], official);
    expect(html).toContain('Registro oficial de turismo');
    expect(html).toContain('Junta de Andalucía');
    // es-ES omits the thousands separator on 4-digit numbers.
    expect(html).toContain('Registro oficial de turismo (9578)');
    // Single dynamic row: 34 vecinales + 9578 oficiales = 9612 combinadas,
    // with the per-state values baked into data attributes.
    expect(html).toContain('data-ambas="9612"');
    expect(html).toContain('data-oficial="9578"');
    expect(html).toContain('data-vecinal="34"');
    expect(html).toContain('viviendas en alquiler turístico');
    expect(html).toContain('data-toggle-source="oficial"');
    expect(html).toContain('data-toggle-source="vecinal"');
    // 9.578 VUT sobre 266.588 hogares principales del Censo 2021 ≈ 3,6%.
    expect(html).toContain('3,6% de todos los hogares principales');
    expect(html).toContain('doi.org/10.1016/j.jue.2020.103278');
    expect(html).toContain('CC BY 4.0');
    expect(html).toContain('fuente=ambas');
  });

  it('renders official-only cities without community records', () => {
    const official: OfficialCityStats = {
      total: 15754,
      entireHomes: 15000,
      roomsOnly: 754,
      roomsInhabitants: 1130,
      places: 60000,
      source: 'openrta',
      updatedAt: new Date('2026-07-20T04:30:00Z'),
    };
    const html = renderCityPage(
      city({
        id: 'marbella',
        name: 'Marbella',
        listingsCount: 0,
        lostDwellings: 0,
        lostFamilies: 0,
        lostInhabitants: 0,
        lostCommercial: 0,
        updatedAt: null,
      }),
      [],
      official,
    );
    expect(html).toContain('Viviendas perdidas en Marbella');
    expect(html).toContain('15.754');
    expect(html).toContain('plazas turísticas oficiales');
  });

  it('credits the Catalan registry (and the city-hall coordinates) for rtc cities', () => {
    const official: OfficialCityStats = {
      total: 10650,
      entireHomes: 10649,
      roomsOnly: 1,
      roomsInhabitants: 1,
      places: 60000,
      source: 'rtc',
      updatedAt: new Date('2026-07-28T04:30:00Z'),
    };
    const html = renderCityPage(
      city({
        id: 'barcelona',
        name: 'Barcelona',
        listingsCount: 0,
        lostDwellings: 0,
        lostFamilies: 0,
        lostInhabitants: 0,
        lostCommercial: 0,
        updatedAt: null,
      }),
      [],
      official,
    );
    expect(html).toContain('Registro de Turismo de Cataluña');
    expect(html).toContain('Ajuntament de Barcelona');
    expect(html).not.toContain('Junta de Andalucía');
    // 10.650 VUT sobre 671.177 hogares principales (Idescat, Censo 2021) ≈ 1,6%.
    expect(html).toContain('1,6% de todos los hogares principales');
  });

  it('renders the evolution figure with deltas when history exists', () => {
    const official: OfficialCityStats = {
      total: 9700,
      entireHomes: 9000,
      roomsOnly: 700,
      roomsInhabitants: 1050,
      places: 40000,
      source: 'openrta',
      updatedAt: new Date('2026-07-31T04:30:00Z'),
    };
    const html = renderCityPage(city({ id: 'sevilla', name: 'Sevilla' }), [], official, [
      { date: '2026-07-17', total: 9500 },
      { date: '2026-07-24', total: 9578 },
      { date: '2026-07-31', total: 9700 },
    ]);
    expect(html).toContain('Evolución del registro oficial');
    expect(html).toContain('▲ +122 desde la sincronización anterior');
    expect(html).toContain('▲ +200 desde el 17/07/26');
    expect(html).toContain('class="evo-chart"');
    expect(html).toContain('/estadisticas');
  });

  it('renders a first-snapshot note instead of a one-point chart', () => {
    const official: OfficialCityStats = {
      total: 628,
      entireHomes: 628,
      roomsOnly: 0,
      roomsInhabitants: 0,
      places: 4406,
      source: 'caib',
      updatedAt: new Date('2026-07-31T04:30:00Z'),
    };
    const html = renderCityPage(
      city({ id: 'palma', name: 'Palma', listingsCount: 0, lostDwellings: 0 }),
      [],
      official,
      [{ date: '2026-07-31', total: 628 }],
    );
    expect(html).toContain('Primer registro del histórico: 628 viviendas (31/07/26)');
    expect(html).not.toContain('class="evo-chart"');
  });

  it('credits the Valencian registry and the Catastro for gva cities', () => {
    const official: OfficialCityStats = {
      total: 5765,
      entireHomes: 5765,
      roomsOnly: 0,
      roomsInhabitants: 0,
      places: 30000,
      source: 'gva',
      updatedAt: new Date('2026-07-30T04:30:00Z'),
    };
    const html = renderCityPage(
      city({
        id: 'valencia',
        name: 'València',
        listingsCount: 0,
        lostDwellings: 0,
        lostFamilies: 0,
        lostInhabitants: 0,
        lostCommercial: 0,
        updatedAt: null,
      }),
      [],
      official,
    );
    expect(html).toContain('Registro de Turismo de la Comunidad Valenciana');
    expect(html).toContain('Catastro');
    expect(html).not.toContain('Junta de Andalucía');
    // 5.765 VUT sobre 328.979 hogares principales (INE, Censo 2021) ≈ 1,8%.
    expect(html).toContain('1,8% de todos los hogares principales');
  });
});

describe('renderCitiesIndex', () => {
  it('lists every city with a link to its page', () => {
    const html = renderCitiesIndex([city(), city({ id: 'sevilla', name: 'Sevilla' })]);
    expect(html).toContain('href="/ciudad/valencia"');
    expect(html).toContain('href="/ciudad/sevilla"');
    expect(html).toContain('Sevilla');
  });

  it('shows the official count for mirrored cities', () => {
    const html = renderCitiesIndex([
      { ...city({ id: 'sevilla', name: 'Sevilla' }), officialTotal: 9578 },
    ]);
    expect(html).toContain('9578 oficiales');
  });
});

describe('renderSitemap', () => {
  it('includes the static pages and one entry per city with lastmod', () => {
    const xml = renderSitemap([city()]);
    expect(xml).toContain('<loc>https://www.aquiviviamos.com/</loc>');
    expect(xml).toContain('<loc>https://www.aquiviviamos.com/ciudades</loc>');
    expect(xml).toContain(
      '<loc>https://www.aquiviviamos.com/ciudad/valencia</loc><lastmod>2026-07-15</lastmod>',
    );
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });
});
