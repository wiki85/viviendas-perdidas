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
import type { Aggregate, OfficialViewportStats, SearchPlace, SourceMode } from '../domain/types';
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
  /** Official registry figures for the visible map area (null while loading). */
  official: OfficialViewportStats | null;
  /** Whether the official figures are usable, still loading, or failed. */
  officialStatus: 'ready' | 'loading' | 'error';
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
  official,
  officialStatus,
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
        {sourceMode === 'official' ? (
          officialStatus === 'ready' ? (
            <>
              <span>{formatInteger(aggregate.listingsCount)}</span> viviendas del registro oficial a
              la vista
            </>
          ) : officialStatus === 'loading' ? (
            <>Cargando el registro oficial…</>
          ) : (
            <>No se ha podido cargar el registro oficial.</>
          )
        ) : (
          <>
            <span>{formatInteger(aggregate.listingsCount)}</span>{' '}
            {aggregate.listingsCount === 1 ? 'registro colaborativo' : 'registros colaborativos'}
            {sourceMode === 'both' && officialStatus === 'ready'
              ? ` + ${formatInteger(official?.total ?? 0)} del registro oficial`
              : ''}
          </>
        )}
      </p>
      {sourceMode !== 'citizens' && (
        <>
          <p
            className={`official-strip ${sourceMode === 'official' ? 'official-strip--solo' : ''}`}
          >
            <Landmark size={15} aria-hidden="true" />
            {officialStatus === 'loading' ? (
              <span>Cargando el registro oficial de turismo…</span>
            ) : officialStatus === 'error' ? (
              <span>
                No se ha podido cargar el registro oficial. Mueve el mapa para reintentarlo.
              </span>
            ) : official && official.total > 0 ? (
              <span>
                Registro oficial: <strong>{formatInteger(official.entireHomes)}</strong>{' '}
                {official.entireHomes === 1
                  ? 'vivienda turística completa'
                  : 'viviendas turísticas completas'}{' '}
                en la zona visible
                {official.roomsOnly > 0
                  ? ` (+${formatInteger(official.roomsOnly)} por habitaciones)`
                  : ''}
              </span>
            ) : (
              <span>
                Sin viviendas del registro oficial en esta zona (cobertura: Andalucía y Barcelona).
              </span>
            )}
          </p>
          <p className="official-credit">
            Fuentes:{' '}
            <a
              href="https://datos.gob.es/es/catalogo/a01002820-openrta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Registro de Turismo de Andalucía
            </a>{' '}
            (Junta de Andalucía,{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>
            ) y{' '}
            <a
              href="https://analisi.transparenciacatalunya.cat/d/t2h3-cgys"
              target="_blank"
              rel="noopener noreferrer"
            >
              Registre de Turisme de Catalunya
            </a>{' '}
            (Generalitat de Catalunya,{' '}
            <a
              href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies"
              target="_blank"
              rel="noopener noreferrer"
            >
              llicència oberta
            </a>
            ) con coordenadas del{' '}
            <a
              href="https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ajuntament de Barcelona
            </a>{' '}
            (CC BY 4.0). Datos adaptados, sin respaldo oficial.
          </p>
        </>
      )}
    </header>
  );
}
