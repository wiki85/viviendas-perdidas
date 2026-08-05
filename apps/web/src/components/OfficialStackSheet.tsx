import { useEffect, useRef } from 'react';
import { BedDouble, Building2, DoorOpen, X } from 'lucide-react';
import type { OfficialPin } from '../domain/types';

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
  const closeButton = useRef<HTMLButtonElement>(null);
  const first = pins[0];

  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  if (!first) return null;
  return (
    <div
      className="sheet-layer"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="bottom-sheet stack-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stack-title"
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button
          ref={closeButton}
          className="sheet-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar lista"
        >
          <X size={20} />
        </button>
        <div className="stack-sheet__body">
          <span className="stack-sheet__icon" aria-hidden="true">
            <Building2 size={22} />
          </span>
          <h2 id="stack-title">{pins.length} viviendas turísticas oficiales en este portal</h2>
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
      </section>
    </div>
  );
}
