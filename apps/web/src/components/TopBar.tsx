import {
  CircleHelp,
  Coffee,
  House,
  Landmark,
  MapPinned,
  Share2,
  Store,
  UsersRound,
} from 'lucide-react';
import type { Aggregate, OfficialStats, SearchPlace, SourceMode } from '../domain/types';
import { useCountUp } from '../hooks/use-count-up';
import { formatInteger } from '../lib/impact';
import { BrandMark } from './BrandMark';
import { SearchBar } from './SearchBar';

type Props = {
  aggregate: Aggregate;
  viewportMode: boolean;
  loading: boolean;
  mapsEnabled: boolean;
  sourceMode: SourceMode;
  onSourceModeChange: (mode: SourceMode) => void;
  /** Official registry stats for the visible scope's city (null outside Andalucía). */
  officialStats: OfficialStats | null;
  sourceToggleAvailable: boolean;
  onSelectPlace: (place: SearchPlace) => void;
  onOpenAbout: () => void;
  onOpenDonate: () => void;
  onShare: () => void;
};

const SOURCE_LABELS: Record<SourceMode, string> = {
  citizens: 'Vecinal',
  official: 'Oficial',
  both: 'Ambas',
};

function Metric({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const animated = useCountUp(value);
  return (
    <div className="metric">
      <span className="metric__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric__number">{formatInteger(animated)}</span>
      <span className="metric__label">{label}</span>
    </div>
  );
}

export function TopBar({
  aggregate,
  viewportMode,
  loading,
  mapsEnabled,
  sourceMode,
  onSourceModeChange,
  officialStats,
  sourceToggleAvailable,
  onSelectPlace,
  onOpenAbout,
  onOpenDonate,
  onShare,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand-row">
        <BrandMark />
        <div className="topbar__actions">
          <button
            className="icon-button"
            type="button"
            onClick={onShare}
            title={`Compartir datos de ${aggregate.name}`}
            aria-label={`Compartir datos de ${aggregate.name}`}
          >
            <Share2 size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onOpenDonate}
            title="Invítame a un café: apoya los costes del proyecto"
            aria-label="Invítame a un café: apoya los costes del proyecto"
          >
            <Coffee size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onOpenAbout}
            title="Acerca del proyecto"
            aria-label="Acerca del proyecto"
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </div>
      <SearchBar mapsEnabled={mapsEnabled} onSelect={onSelectPlace} />
      <div className="scope-line" aria-live="polite" aria-atomic="true">
        <MapPinned size={16} aria-hidden="true" />
        <strong>{aggregate.name}</strong>
        <span>
          {viewportMode
            ? 'Suma de lo visible en el mapa'
            : aggregate.scope === 'neighborhood'
              ? 'Datos del barrio'
              : aggregate.scope === 'city'
                ? 'Datos del municipio'
                : 'Explora una ciudad'}
        </span>
        {loading && <span className="scope-line__pulse" aria-label="Actualizando" />}
      </div>
      {sourceToggleAvailable && (
        <div className="source-toggle" role="radiogroup" aria-label="Fuente de datos">
          {(['citizens', 'official', 'both'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={sourceMode === mode}
              className={sourceMode === mode ? 'is-selected' : ''}
              onClick={() => onSourceModeChange(mode)}
            >
              {SOURCE_LABELS[mode]}
            </button>
          ))}
        </div>
      )}
      {sourceMode !== 'official' && (
        <>
          <div className="metrics" aria-label={`Impacto estimado en ${aggregate.name}`}>
            <Metric value={aggregate.lostDwellings} label="viviendas" icon={<House size={16} />} />
            <Metric
              value={aggregate.lostInhabitants}
              label="habitantes"
              icon={<UsersRound size={17} />}
            />
            <Metric value={aggregate.lostCommercial} label="locales" icon={<Store size={16} />} />
          </div>
          <p className="topbar__records">
            <span>{formatInteger(aggregate.listingsCount)}</span>{' '}
            {aggregate.listingsCount === 1 ? 'registro colaborativo' : 'registros colaborativos'}
          </p>
        </>
      )}
      {sourceMode !== 'citizens' && (
        <>
          <p
            className={`official-strip ${sourceMode === 'official' ? 'official-strip--solo' : ''}`}
          >
            <Landmark size={15} aria-hidden="true" />
            {officialStats ? (
              <span>
                Registro oficial (RTA): <strong>{formatInteger(officialStats.entireHomes)}</strong>{' '}
                viviendas turísticas completas en{' '}
                {officialStats.municipality.toLocaleLowerCase('es')}
                {officialStats.roomsOnly > 0
                  ? ` (+${formatInteger(officialStats.roomsOnly)} por habitaciones)`
                  : ''}
              </span>
            ) : (
              <span>Sin datos oficiales para esta zona (disponibles en Andalucía).</span>
            )}
          </p>
          <p className="official-credit">
            Fuente:{' '}
            <a
              href="https://datos.gob.es/es/catalogo/a01002820-openrta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Registro de Turismo de Andalucía
            </a>{' '}
            (Junta de Andalucía), datos adaptados ·{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>
            . Sin respaldo oficial.
          </p>
        </>
      )}
    </header>
  );
}
