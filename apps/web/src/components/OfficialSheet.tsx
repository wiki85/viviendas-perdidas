import { useEffect, useRef } from 'react';
import { BedDouble, House, Landmark, MapPin, UsersRound, X } from 'lucide-react';
import type { OfficialPin } from '../domain/types';
import { calculateImpact } from '../lib/impact';

type Props = {
  pin: OfficialPin;
  onClose: () => void;
};

/** Detail card for a dwelling from the official registry (OpenRTA). */
export function OfficialSheet({ pin, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const impact = calculateImpact(pin.entire ? 1 : 0);

  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  return (
    <div
      className="sheet-layer"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="bottom-sheet listing-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-sheet-title"
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button
          ref={closeButton}
          className="sheet-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar ficha"
        >
          <X size={20} />
        </button>
        <div className="listing-sheet__body listing-sheet__body--official">
          <span className="listing-badge listing-badge--official">
            <Landmark size={15} /> Registro oficial de turismo
          </span>
          <h2 id="official-sheet-title">
            {pin.entire ? 'Vivienda de uso turístico' : 'Vivienda turística por habitaciones'}
          </h2>
          <p className="listing-address">
            <MapPin size={17} /> {pin.addressText || pin.name}
            {pin.postalCode ? ` · ${pin.postalCode}` : ''}{' '}
            {pin.municipality ? `· ${pin.municipality.toLocaleLowerCase('es')}` : ''}
          </p>
          <div className="impact-callout">
            <div>
              <House size={19} />
              <span>Licencia</span>
              <strong>{pin.registrationCode}</strong>
            </div>
            <div>
              <BedDouble size={19} />
              <span>Capacidad</span>
              <strong>{pin.places > 0 ? `${pin.places} plazas` : 'No declarada'}</strong>
            </div>
          </div>
          {pin.entire ? (
            <div className="impact-callout">
              <div>
                <UsersRound size={19} />
                <span>Equivale a</span>
                <strong>1 vivienda · ≈{impact.lostInhabitants} habitantes</strong>
              </div>
            </div>
          ) : (
            <p className="listing-note">
              Alquiler por habitaciones: el titular puede seguir residiendo en la vivienda, por lo
              que no la contamos como hogar desplazado.
            </p>
          )}
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
        </div>
      </section>
    </div>
  );
}
