import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MailPlus, TrendingDown, TrendingUp } from 'lucide-react';
import type { OfficialHistoryEntry } from '../domain/types';
import { CITY_MAIN_DWELLINGS } from '../lib/city-impact';
import { cityDisplayName, COMMUNITIES } from '../lib/communities';
import { BrandMark } from './BrandMark';

type Props = {
  onClose: () => void;
  loadHistory: () => Promise<OfficialHistoryEntry[]>;
  onOpenNewsletter: () => void;
};

const formatInt = (value: number) => value.toLocaleString('es-ES');

/** Signed es-ES integer ('+123', '−45', '0'). */
function formatDelta(value: number): string {
  if (value > 0) return `+${formatInt(value)}`;
  if (value < 0) return `−${formatInt(Math.abs(value))}`;
  return '0';
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year?.slice(2)}`;
}

/** Rounded "nice" ticks fitted to the DATA RANGE, not to zero: with totals
 * around 80k a weekly delta of a few hundred is invisible on a 0-based axis,
 * so the domain hugs [min, max] (first tick ≤ min, last tick ≥ max — data
 * never clips). Absolute labels stay on the axis, so the zoomed scale is
 * always explicit. */
function niceTicks(minimum: number, maximum: number): number[] {
  if (maximum <= minimum) {
    // Flat series (or a single point): open a small window around the value.
    const margin = Math.max(1, Math.round(maximum * 0.01));
    minimum = Math.max(0, minimum - margin);
    maximum += margin;
  }
  const raw = (maximum - minimum) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const start = Math.max(0, Math.floor(minimum / step) * step);
  const ticks: number[] = [];
  for (let tick = start; ; tick += step) {
    ticks.push(tick);
    if (tick >= maximum) break;
  }
  return ticks;
}

type SeriesPoint = { date: string; total: number };

type SortKey = 'name' | 'total' | 'deltaLast' | 'deltaSinceFirst' | 'places' | 'pressure';

/** Copy-paste iframe snippets so any site can embed the current selection. */
function EmbedCodes({ slug, label }: { slug: string; label: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const snippet = (kind: 'evolucion' | 'cifras', height: number) =>
    `<iframe src="https://www.aquiviviamos.com/embed/${slug}/${kind}" title="Viviendas turísticas registradas — ${label}" width="100%" height="${height}" style="border:0;max-width:720px" loading="lazy"></iframe>`;
  const copy = (kind: 'evolucion' | 'cifras', height: number) => {
    void navigator.clipboard?.writeText(snippet(kind, height)).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return (
    <section className="stats-embed">
      <h2>Inserta estas cifras en tu web</h2>
      <p>
        Copia el código y pégalo en tu página o CMS: la gráfica se actualizará sola con cada
        sincronización, con los datos de <strong>{label}</strong> (según los filtros de arriba) y su
        fuente citada.
      </p>
      <div className="stats-embed__row">
        <code>{snippet('evolucion', 420)}</code>
        <button
          type="button"
          className="button button--primary"
          onClick={() => copy('evolucion', 420)}
        >
          {copied === 'evolucion' ? '¡Copiado!' : 'Copiar gráfica'}
        </button>
      </div>
      <div className="stats-embed__row">
        <code>{snippet('cifras', 230)}</code>
        <button
          type="button"
          className="button button--primary"
          onClick={() => copy('cifras', 230)}
        >
          {copied === 'cifras' ? '¡Copiado!' : 'Copiar cifras'}
        </button>
      </div>
    </section>
  );
}

/**
 * Single-series evolution line: 2px stroke, 10% area wash, hairline grid,
 * crosshair snapped to the nearest sync date with a tooltip readout. The
 * table below the charts keeps every value reachable without hovering.
 */
function EvolutionChart({ points }: { points: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 720;
  const height = 260;
  const pad = { top: 18, right: 74, bottom: 30, left: 58 };

  if (points.length === 0) return null;
  const maxTotal = Math.max(...points.map((point) => point.total));
  const minTotal = Math.min(...points.map((point) => point.total));
  const ticks = niceTicks(minTotal, maxTotal);
  const floor = ticks[0] ?? minTotal;
  const top = ticks[ticks.length - 1] ?? maxTotal;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) =>
    pad.top + innerH - (top === floor ? 0 : ((value - floor) / (top - floor)) * innerH);

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.total).toFixed(1)}`,
    )
    .join(' ');
  const plotBottom = (pad.top + innerH).toFixed(1);
  const area = `${path} L${x(points.length - 1).toFixed(1)},${plotBottom} L${x(0).toFixed(1)},${plotBottom} Z`;
  const last = points[points.length - 1];

  const onMove = (event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg || points.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((px - pad.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <div className="viz-plot">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolución del número de viviendas turísticas oficiales"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              className="viz-grid"
            />
            <text x={pad.left - 8} y={y(tick) + 4} className="viz-tick" textAnchor="end">
              {formatInt(tick)}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={area} className="viz-area" />}
        {points.length > 1 && <path d={path} className="viz-line" />}
        {(points.length === 1 ? [0] : [points.length - 1]).map((index) => (
          <circle
            key={index}
            cx={x(index)}
            cy={y(points[index]?.total ?? 0)}
            r={5}
            className="viz-dot"
          />
        ))}
        {last && (
          <text
            x={x(points.length - 1) + 10}
            y={y(last.total) + 4}
            className="viz-endlabel"
            textAnchor="start"
          >
            {formatInt(last.total)}
          </text>
        )}
        {points.map((point, index) => (
          <text
            key={point.date}
            x={x(index)}
            y={height - 8}
            className="viz-tick"
            textAnchor="middle"
            style={
              points.length > 8 && index % Math.ceil(points.length / 8) !== 0
                ? { display: 'none' }
                : undefined
            }
          >
            {formatDay(point.date)}
          </text>
        ))}
        {hover !== null && points[hover] && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={pad.top + innerH}
            className="viz-crosshair"
          />
        )}
      </svg>
      {hover !== null && points[hover] && (
        <div className="viz-tooltip" style={{ left: `${(x(hover) / width) * 100}%` }} role="status">
          <strong>{formatInt(points[hover].total)}</strong>
          <span>{formatDay(points[hover].date)}</span>
        </div>
      )}
      {points.length === 1 && (
        <p className="viz-note">
          Primer registro del histórico. La gráfica crecerá con cada sincronización semanal.
        </p>
      )}
    </div>
  );
}

/** Horizontal magnitude bars: ≤24px thick, rounded data-end, value at tip. */
function BarChart({
  rows,
  hue,
  format,
  ariaLabel,
}: {
  rows: Array<{ id: string; label: string; value: number }>;
  hue: 'pressure' | 'total';
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const maximum = Math.max(...rows.map((row) => row.value), 0);
  if (rows.length === 0 || maximum === 0) return null;
  return (
    <div className="viz-bars" role="img" aria-label={ariaLabel}>
      {rows.map((row) => (
        <div
          key={row.id}
          className={`viz-bar-row ${hover === row.id ? 'is-hover' : ''}`}
          onPointerEnter={() => setHover(row.id)}
          onPointerLeave={() => setHover(null)}
        >
          <span className="viz-bar-label">{row.label}</span>
          <span className="viz-bar-track">
            <span
              className={`viz-bar-fill viz-bar-fill--${hue}`}
              style={{ width: `${Math.max(1.5, (row.value / maximum) * 100)}%` }}
            />
            <span className="viz-bar-value">{format(row.value)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="viz-delta viz-delta--up">
        <TrendingUp size={14} aria-hidden="true" /> {formatDelta(value)}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="viz-delta viz-delta--down">
        <TrendingDown size={14} aria-hidden="true" /> {formatDelta(value)}
      </span>
    );
  }
  return <span className="viz-delta viz-delta--flat">= sin cambio</span>;
}

export function StatsPage({ onClose, loadHistory, onOpenNewsletter }: Props) {
  const [entries, setEntries] = useState<OfficialHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [communityId, setCommunityId] = useState('todas');
  const [cityId, setCityId] = useState('todas');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'total',
    direction: 'desc',
  });

  useEffect(() => {
    loadHistory().then(setEntries, () => setError(true));
  }, [loadHistory]);

  const cityOptions = useMemo(() => {
    const community = COMMUNITIES.find((entry) => entry.id === communityId);
    const ids = community ? community.cityIds : COMMUNITIES.flatMap((entry) => entry.cityIds);
    return [...ids].sort((a, b) => cityDisplayName(a).localeCompare(cityDisplayName(b), 'es'));
  }, [communityId]);

  const scopeCityIds = useMemo(
    () => (cityId === 'todas' ? cityOptions : [cityId]),
    [cityId, cityOptions],
  );

  const model = useMemo(() => {
    if (!entries) return null;
    const scoped = entries.filter((entry) => scopeCityIds.includes(entry.cityId));
    // Carry-forward sum: only the cities synced on a given day get a fresh
    // snapshot (the rest are weekly), so a naive per-date sum would collapse
    // to the few just-synced cities. A city keeps its last known total until
    // a newer snapshot replaces it — the line then means "known stock" and
    // only moves when a sync actually changes something (or a new city
    // enters the mirror).
    const dates = [...new Set(scoped.map((entry) => entry.date))].sort();
    const totalsByCityDate = new Map<string, number>();
    for (const entry of scoped) {
      totalsByCityDate.set(`${entry.cityId}|${entry.date}`, entry.total);
    }
    const lastKnown = new Map<string, number>();
    const series: SeriesPoint[] = dates.map((date) => {
      for (const id of scopeCityIds) {
        const total = totalsByCityDate.get(`${id}|${date}`);
        if (total !== undefined) lastKnown.set(id, total);
      }
      let sum = 0;
      for (const total of lastKnown.values()) sum += total;
      return { date, total: sum };
    });

    const byCity = new Map<string, OfficialHistoryEntry[]>();
    for (const entry of scoped) {
      const bucket = byCity.get(entry.cityId);
      if (bucket) bucket.push(entry);
      else byCity.set(entry.cityId, [entry]);
    }
    const cities = [...byCity.entries()].map(([id, history]) => {
      const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      const first = sorted[0];
      const dwellings = CITY_MAIN_DWELLINGS[id];
      return {
        id,
        name: cityDisplayName(id),
        total: latest?.total ?? 0,
        places: latest?.places ?? 0,
        deltaLast: previous && latest ? latest.total - previous.total : 0,
        deltaSinceFirst: first && latest ? latest.total - first.total : 0,
        firstDate: first?.date ?? '',
        pressure:
          dwellings && latest ? Math.round((latest.total / dwellings) * 1000 * 10) / 10 : null,
      };
    });
    cities.sort((a, b) => b.total - a.total);

    const latestTotal = series[series.length - 1]?.total ?? 0;
    const previousTotal = series.length > 1 ? (series[series.length - 2]?.total ?? 0) : latestTotal;
    const places = cities.reduce((sum, city) => sum + city.places, 0);
    const knownDwellings = cities
      .filter((city) => CITY_MAIN_DWELLINGS[city.id] !== undefined)
      .reduce((sum, city) => sum + (CITY_MAIN_DWELLINGS[city.id] ?? 0), 0);
    const knownTotal = cities
      .filter((city) => CITY_MAIN_DWELLINGS[city.id] !== undefined)
      .reduce((sum, city) => sum + city.total, 0);
    return {
      series,
      cities,
      latestTotal,
      deltaLast: latestTotal - previousTotal,
      places,
      sharePct: knownDwellings > 0 ? Math.round((knownTotal / knownDwellings) * 1000) / 10 : null,
    };
  }, [entries, scopeCityIds]);

  const sortedCities = useMemo(() => {
    if (!model) return [];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...model.cities].sort((a, b) => {
      if (sort.key === 'name') return factor * a.name.localeCompare(b.name, 'es');
      // Las ciudades sin censo (presión nula) van siempre al final.
      const va = sort.key === 'pressure' ? a.pressure : a[sort.key];
      const vb = sort.key === 'pressure' ? b.pressure : b[sort.key];
      if (va === null && vb === null) return a.name.localeCompare(b.name, 'es');
      if (va === null) return 1;
      if (vb === null) return -1;
      return factor * (va - vb) || a.name.localeCompare(b.name, 'es');
    });
  }, [model, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' },
    );
  };

  const sortHeader = (key: SortKey, label: string, numeric = true) => (
    <th
      className={numeric ? 'num' : undefined}
      aria-sort={
        sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
      }
    >
      <button
        type="button"
        className={`stats-sort ${sort.key === key ? 'is-active' : ''}`}
        onClick={() => toggleSort(key)}
      >
        {label}
        <span aria-hidden="true" className="stats-sort__arrow">
          {sort.key === key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );

  return (
    <main className="about-page stats-page">
      <nav className="about-page__nav">
        <button className="button button--ghost" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al mapa
        </button>
        <BrandMark />
      </nav>
      <article className="about-page__article stats-page__article">
        <p className="eyebrow">Estadísticas</p>
        <h1>Evolución del registro oficial de viviendas turísticas</h1>
        <p className="stats-page__intro">
          Cada sincronización semanal con los registros autonómicos guarda una instantánea por
          ciudad: así puede verse dónde crecen las licencias, dónde se frenan y qué ciudades
          soportan más presión, con datos oficiales citables.
        </p>

        <div className="stats-filters" role="group" aria-label="Filtros">
          <label>
            Comunidad
            <select
              value={communityId}
              onChange={(event) => {
                setCommunityId(event.target.value);
                setCityId('todas');
              }}
            >
              <option value="todas">Todas</option>
              {COMMUNITIES.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ciudad
            <select value={cityId} onChange={(event) => setCityId(event.target.value)}>
              <option value="todas">Todas</option>
              {cityOptions.map((id) => (
                <option key={id} value={id}>
                  {cityDisplayName(id)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="field-error" role="alert">
            No se ha podido cargar el histórico. Inténtalo de nuevo en un momento.
          </p>
        )}
        {!entries && !error && <p className="viz-note">Cargando histórico…</p>}

        {model && model.series.length > 0 && (
          <>
            <div className="stats-kpis">
              <div className="stat-tile">
                <span className="stat-tile__label">Viviendas turísticas oficiales</span>
                <strong className="stat-tile__value">{formatInt(model.latestTotal)}</strong>
                <DeltaBadge value={model.deltaLast} />
              </div>
              <div className="stat-tile">
                <span className="stat-tile__label">Plazas turísticas</span>
                <strong className="stat-tile__value">{formatInt(model.places)}</strong>
              </div>
              {model.sharePct !== null && (
                <div className="stat-tile">
                  <span className="stat-tile__label">Sobre hogares principales</span>
                  <strong className="stat-tile__value">
                    {model.sharePct.toLocaleString('es-ES')}%
                  </strong>
                </div>
              )}
              <div className="stat-tile">
                <span className="stat-tile__label">Ciudades en el ámbito</span>
                <strong className="stat-tile__value">{model.cities.length}</strong>
              </div>
            </div>

            <section className="stats-section">
              <h2>Evolución del total</h2>
              <EvolutionChart points={model.series} />
            </section>

            {model.cities.length > 1 && (
              <section className="stats-section">
                <h2>Presión turística (viviendas oficiales por 1.000 hogares)</h2>
                <BarChart
                  ariaLabel="Presión turística por ciudad"
                  hue="pressure"
                  rows={model.cities
                    .filter((city) => city.pressure !== null)
                    .sort((a, b) => (b.pressure ?? 0) - (a.pressure ?? 0))
                    .map((city) => ({
                      id: city.id,
                      label: city.name,
                      value: city.pressure ?? 0,
                    }))}
                  format={(value) => value.toLocaleString('es-ES')}
                />
              </section>
            )}

            {model.cities.length > 1 && (
              <section className="stats-section">
                <h2>Viviendas turísticas registradas</h2>
                <BarChart
                  ariaLabel="Total de viviendas turísticas por ciudad"
                  hue="total"
                  rows={model.cities.map((city) => ({
                    id: city.id,
                    label: city.name,
                    value: city.total,
                  }))}
                  format={formatInt}
                />
              </section>
            )}

            <section className="stats-section">
              <h2>Detalle por ciudad</h2>
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead>
                    <tr>
                      {sortHeader('name', 'Ciudad', false)}
                      {sortHeader('total', 'Viviendas')}
                      {sortHeader('deltaLast', 'Última sync')}
                      {sortHeader('deltaSinceFirst', 'Desde el inicio')}
                      {sortHeader('places', 'Plazas')}
                      {sortHeader('pressure', 'Por 1.000 hogares')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCities.map((city) => (
                      <tr key={city.id}>
                        <td>
                          <a href={`/ciudad/${city.id}`}>{city.name}</a>
                        </td>
                        <td className="num">{formatInt(city.total)}</td>
                        <td className="num">
                          <DeltaBadge value={city.deltaLast} />
                        </td>
                        <td className="num">{formatDelta(city.deltaSinceFirst)}</td>
                        <td className="num">{formatInt(city.places)}</td>
                        <td className="num">
                          {city.pressure !== null ? city.pressure.toLocaleString('es-ES') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="stats-page__sources">
              Fuentes: registros oficiales de turismo de Andalucía, Cataluña, Comunitat Valenciana,
              Mallorca, Navarra y Euskadi (ver <a href="/metodologia">metodología y licencias</a>).
              La presión compara con los hogares principales del Censo 2021 (INE/IECA/Idescat).
            </p>

            <EmbedCodes
              slug={cityId !== 'todas' ? cityId : communityId !== 'todas' ? communityId : 'todo'}
              label={
                cityId !== 'todas'
                  ? cityDisplayName(cityId)
                  : communityId !== 'todas'
                    ? (COMMUNITIES.find((entry) => entry.id === communityId)?.name ?? communityId)
                    : 'España (ciudades cubiertas)'
              }
            />

            <section className="stats-subscribe">
              <div>
                <h2>El Recuento: estas cifras, en tu correo</h2>
                <p>
                  Cada semana o cada mes, las variaciones de las zonas que elijas — y solo si hay
                  cambios. También hay feeds RSS por ciudad.
                </p>
              </div>
              <button className="button button--primary" type="button" onClick={onOpenNewsletter}>
                <MailPlus size={18} /> Suscribirse gratis
              </button>
            </section>
          </>
        )}
      </article>
    </main>
  );
}
