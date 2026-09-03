import { Sheet } from '../Sheet';
import { ImpactDetails, type ImpactDetailsProps } from './ImpactDetails';

type Props = ImpactDetailsProps & { onClose: () => void };

/** Hoja móvil con el detalle de las cifras de la zona visible. */
export function ImpactSheet({ onClose, ...impact }: Props) {
  return (
    <Sheet labelledBy="impact-title" onClose={onClose} closeLabel="Cerrar cifras">
      <div className="sheet__body impact-sheet" id="impact-sheet">
        <p className="eyebrow">Cifras de la zona</p>
        <h2 id="impact-title" className="sheet__title">
          {impact.aggregate.name}
        </h2>
        <ImpactDetails {...impact} large hideScopeName />
      </div>
    </Sheet>
  );
}
