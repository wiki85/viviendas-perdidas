import { describe, expect, it } from 'vitest';
import { renderSourcesPage, RUBRIC, SOURCES, sourceTotal } from './render-sources.js';

describe('rúbrica de fuentes', () => {
  it('los máximos de los criterios suman 100', () => {
    expect(RUBRIC.reduce((sum, criterion) => sum + criterion.max, 0)).toBe(100);
  });

  it('ninguna puntuación excede el máximo de su criterio', () => {
    for (const source of SOURCES) {
      for (const criterion of RUBRIC) {
        expect(source.score[criterion.key]).toBeGreaterThanOrEqual(0);
        expect(source.score[criterion.key]).toBeLessThanOrEqual(criterion.max);
      }
      expect(sourceTotal(source)).toBeGreaterThan(0);
      expect(sourceTotal(source)).toBeLessThanOrEqual(100);
    }
  });

  it('cubre las siete fuentes sincronizadas', () => {
    expect(SOURCES.map((source) => source.id).sort()).toEqual(
      ['caib', 'can', 'cat', 'eus', 'gva', 'mad', 'nav', 'rta'].sort(),
    );
  });
});

describe('renderSourcesPage', () => {
  const html = renderSourcesPage();

  it('lista todas las comunidades con su puntuación y enlaces', () => {
    for (const source of SOURCES) {
      expect(html).toContain(source.ccaa);
      expect(html).toContain(`${sourceTotal(source)}/100`);
      for (const link of source.links) expect(html).toContain(link.url);
    }
  });

  it('explica la rúbrica y la fecha de revisión', () => {
    for (const criterion of RUBRIC) expect(html).toContain(criterion.label);
    expect(html).toContain('Última revisión');
  });
});
