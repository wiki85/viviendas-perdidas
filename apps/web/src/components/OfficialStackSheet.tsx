import { BedDouble, Building2, DoorOpen } from 'lucide-react';
import type { OfficialPin } from '../domain/types';
import { Sheet } from './Sheet';

type Props = {
  pins: OfficialPin[];
  onPick: (pin: OfficialPin) => void;
  onClose: () => void;
};

/**
 * Un portal con demasiadas viviendas para la araña (> SPIDERFY_MAX): lista
 * completa de los registros oficiales de esa dirección, cada uno abre su
 * ficha individual.
 */
export function OfficialStackSheet({ pins, onPick, onClose }: Props) {
  const first = pins[0];
  if (!first) return null;
  return (
    <Sheet variant="panel" labelledBy="stack-title" onClose={onClose} closeLabel="Cerrar lista">
      <div className="sheet__body stack-sheet__body">
        <span className="stack-sheet__icon" aria-hidden="true">
          <Building2 size={22} />
        </span>
        <h2 id="stack-title" className="sheet__title">
          {pins.length} viviendas turísticas oficiales en este portal
        </h2>
        <p className="stack-sheet__address">
          {first.addressText}
          {first.municipality ? ` · ${first.municipality}` : ''}
        </p>
        <ul className="stack-sheet__list">
          {pins.map((pin) => (
            <li key={pin.id}>
              <button type="button" onClick={() => onPick(pin)}>
                <strong>{pin.registrationCode}</strong>
                <span>
                  {pin.entire ? (
                    <>
                      <DoorOpen size={14} aria-hidden="true" /> Vivienda completa
                    </>
                  ) : (
                    <>
                      <BedDouble size={14} aria-hidden="true" /> Por habitaciones
                    </>
                  )}
                  {pin.places > 0 ? ` · ${pin.places} plazas` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
