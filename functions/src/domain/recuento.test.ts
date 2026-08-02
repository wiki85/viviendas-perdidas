import { describe, expect, it } from 'vitest';
import { cityIdsForScope, scopeDisplayName } from './communities.js';
import {
  buildFeedItems,
  computeCityDeltas,
  editionSubject,
  formatDeltaSigned,
  renderEditionHtml,
  renderFeedXml,
  type HistoryPoint,
} from './recuento.js';

const HISTORY: HistoryPoint[] = [
  { cityId: 'sevilla', date: '2026-07-20', total: 9500 },
  { cityId: 'sevilla', date: '2026-07-27', total: 9578 },
  { cityId: 'sevilla', date: '2026-08-03', total: 9612 },
  { cityId: 'benidorm', date: '2026-07-27', total: 5633 },
  { cityId: 'benidorm', date: '2026-08-03', total: 5645 },
  { cityId: 'madrid', date: '2026-08-03', total: 1156 },
];

describe('scopes', () => {
  it('resolves cities for every scope kind and rejects unknowns', () => {
    expect(cityIdsForScope('city:sevilla')).toEqual(['sevilla']);
    expect(cityIdsForScope('community:euskadi')).toEqual(['donostia', 'bilbao']);
    expect(cityIdsForScope('all').length).toBe(19);
    expect(cityIdsForScope('city:paris')).toEqual([]);
    expect(cityIdsForScope('drop table')).toEqual([]);
  });

  it('labels scopes for humans', () => {
    expect(scopeDisplayName('community:comunitat-valenciana')).toBe('Comunitat Valenciana');
    expect(scopeDisplayName('city:donostia')).toBe('Donostia / San Sebastián');
  });
});

describe('computeCityDeltas', () => {
  it('compares the latest snapshot against the baseline at the window start', () => {
    const deltas = computeCityDeltas(HISTORY, ['sevilla', 'benidorm'], '2026-07-27');
    expect(deltas).toEqual([
      { cityId: 'sevilla', name: 'Sevilla', total: 9612, previous: 9578, delta: 34 },
      { cityId: 'benidorm', name: 'Benidorm', total: 5645, previous: 5633, delta: 12 },
    ]);
  });

  it('uses the first snapshot as baseline for cities newer than the window', () => {
    const deltas = computeCityDeltas(HISTORY, ['madrid'], '2026-07-27');
    expect(deltas[0]).toMatchObject({ total: 1156, delta: 0 });
  });

  it('formats deltas with sign and words, never bare color semantics', () => {
    expect(formatDeltaSigned(34)).toBe('▲ +34');
    expect(formatDeltaSigned(-5)).toBe('▼ −5');
    expect(formatDeltaSigned(0)).toBe('= sin cambios');
  });
});

describe('edition rendering', () => {
  const input = {
    edition: 'semanal' as const,
    dateLabel: '3 de agosto de 2026',
    scopes: [
      {
        scopeLabel: 'Sevilla',
        deltas: computeCityDeltas(HISTORY, ['sevilla'], '2026-07-27'),
      },
    ],
    siteUrl: 'https://www.aquiviviamos.com',
    unsubscribeUrl: 'https://www.aquiviviamos.com/boletin/baja?t=abc',
    preferencesUrl: 'https://www.aquiviviamos.com/boletin',
  };

  it('leads the subject with the signed total delta', () => {
    expect(editionSubject(input)).toBe(
      '▲ +34 viviendas turísticas en tus zonas — El Recuento, 3 de agosto de 2026',
    );
  });

  it('renders the branded email with figures, CTA and one-click unsubscribe', () => {
    const html = renderEditionHtml(input);
    expect(html).toContain('El Recuento');
    expect(html).toContain('▲ +34');
    expect(html).toContain('9612 registradas');
    expect(html).toContain('/estadisticas');
    expect(html).toContain('baja?t=abc');
    expect(html).toContain('CC BY 4.0');
  });
});

describe('feeds', () => {
  it('emits one item per date where the carried-forward total moved', () => {
    const items = buildFeedItems(
      HISTORY,
      ['sevilla', 'benidorm'],
      'prueba',
      'https://www.aquiviviamos.com',
      'Prueba',
    );
    // 27/07: 9578+5633 (benidorm aparece) → cambia; 03/08: +46 → cambia.
    expect(items).toHaveLength(2);
    expect(items[0]?.guid).toBe('prueba_2026-08-03');
    expect(items[0]?.title).toContain('▲ +46');
  });

  it('renders valid RSS with escaped labels', () => {
    const xml = renderFeedXml('España <total>', '/feeds/todo.xml', 'https://www.aquiviviamos.com', [
      {
        guid: 'todo_2026-08-03',
        title: '▲ +52 viviendas turísticas en España — 3 de agosto de 2026',
        dateIso: '2026-08-03',
        description: 'España pasa de 81.997 a 82.049.',
        link: 'https://www.aquiviviamos.com/estadisticas',
      },
    ]);
    expect(xml).toContain('<title>El Recuento · España &lt;total&gt;</title>');
    expect(xml).toContain('<guid isPermaLink="false">todo_2026-08-03</guid>');
    expect(xml).toContain('application/rss+xml');
  });
});
