import { Coffee } from 'lucide-react';
import type { SearchPlace } from '../../domain/types';
import { BrandIcon } from '../BrandMark';
import { SearchBar } from '../SearchBar';

type Props = {
  mapsEnabled: boolean;
  onSelectPlace: (place: SearchPlace) => void;
  onOpenAbout: () => void;
  onOpenDonate: () => void;
};

/** Cabecera flotante de móvil: marca compacta, buscador y botón de apoyo. */
export function SearchDock({ mapsEnabled, onSelectPlace, onOpenAbout, onOpenDonate }: Props) {
  return (
    <div className="search-dock">
      <button
        className="brand-button"
        type="button"
        onClick={onOpenAbout}
        aria-label="Viviendas Perdidas: acerca del proyecto"
      >
        <BrandIcon />
      </button>
      <SearchBar mapsEnabled={mapsEnabled} onSelect={onSelectPlace} />
      <button
        className="brand-button brand-button--donate"
        type="button"
        onClick={onOpenDonate}
        aria-label="Invítanos a un café: apoya los costes del proyecto"
        title="Invítanos a un café"
      >
        <Coffee size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
