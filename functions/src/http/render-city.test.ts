import { describe, expect, it } from 'vitest';
import { renderCitiesIndex, renderCityPage, renderSitemap, type CityStats } from './render-city.js';

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
});

describe('renderCitiesIndex', () => {
  it('lists every city with a link to its page', () => {
    const html = renderCitiesIndex([city(), city({ id: 'sevilla', name: 'Sevilla' })]);
    expect(html).toContain('href="/ciudad/valencia"');
    expect(html).toContain('href="/ciudad/sevilla"');
    expect(html).toContain('Sevilla');
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
