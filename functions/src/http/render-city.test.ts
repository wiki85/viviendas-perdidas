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
      places: 40000,
      updatedAt: new Date('2026-07-20T04:30:00Z'),
    };
    const html = renderCityPage(city({ id: 'sevilla', name: 'Sevilla' }), [], official);
    expect(html).toContain('Registro oficial de turismo (RTA)');
    // es-ES omits the thousands separator on 4-digit numbers.
    expect(html).toContain('<strong>9578</strong>');
    // Combined: 34 vecinales + 9578 oficiales.
    expect(html).toContain('9612 viviendas</strong>');
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
      places: 60000,
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
