import { CircleHelp, Coffee, House, MapPinned, Share2, Store, UsersRound } from 'lucide-react';
import type { Aggregate, SearchPlace } from '../domain/types';
import { useCountUp } from '../hooks/use-count-up';
import { formatInteger } from '../lib/impact';
import { BrandMark } from './BrandMark';
import { SearchBar } from './SearchBar';

type Props = {
  aggregate: Aggregate;
  viewportMode: boolean;
  loading: boolean;
  mapsEnabled: boolean;
  onSelectPlace: (place: SearchPlace) => void;
  onOpenAbout: () => void;
  onOpenDonate: () => void;
  onShare: () => void;
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
    </header>
  );
}
