import { Coffee } from 'lucide-react';
import type { SearchPlace } from '../../domain/types';
import { BrandMark } from '../BrandMark';
import { SearchBar } from '../SearchBar';
import { ImpactDetails, type ImpactDetailsProps } from './ImpactDetails';

type Props = ImpactDetailsProps & {
  mapsEnabled: boolean;
  onSelectPlace: (place: SearchPlace) => void;
  onOpenDonate: () => void;
};

/** Panel flotante de escritorio: marca, buscador y cifras de la zona visible. */
export function SidePanel({ mapsEnabled, onSelectPlace, onOpenDonate, ...impact }: Props) {
  return (
    <aside className="side-panel" aria-label="Buscador y cifras de la zona visible">
      <div className="side-panel__brand">
        <BrandMark />
        <button
          className="button button--accent button--small donate-button"
          type="button"
          onClick={onOpenDonate}
          title="Apoya los costes del proyecto"
        >
          <Coffee size={17} aria-hidden="true" /> Invítanos a un café
        </button>
      </div>
      <SearchBar mapsEnabled={mapsEnabled} onSelect={onSelectPlace} />
      <ImpactDetails {...impact} />
    </aside>
  );
}
