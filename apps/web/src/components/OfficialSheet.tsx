import { useEffect, useRef } from 'react';
import { BadgeCheck, BedDouble, Landmark, MapPin, UsersRound, X } from 'lucide-react';
import type { OfficialPin } from '../domain/types';
import { calculateImpact } from '../lib/impact';
import { roomsInhabitantsForPlaces } from '../lib/official-cells';
import { officialSourceForPinId } from '../lib/official-sources';

type Props = {
  pin: OfficialPin;
  onClose: () => void;
};

const LOWERCASE_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

/** 'JEREZ DE LA FRONTERA' → 'Jerez de la Frontera' for display. */
function displayMunicipality(value: string): string {
  return value
    .toLocaleLowerCase('es')
    .split(/\s+/u)
    .map((word, index) =>
      index > 0 && LOWERCASE_CONNECTORS.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase('es') + word.slice(1),
    )
    .join(' ');
}

/** Detail card for a dwelling from a mirrored official registry. */
export function OfficialSheet({ pin, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  // Un edificio de apartamentos turísticos representa varias viviendas.
  const units = pin.units && pin.units > 1 ? pin.units : 1;
  const impact = calculateImpact(pin.entire ? units : 0);
  const source = officialSourceForPinId(pin.id);
  const locality = [pin.postalCode, pin.municipality ? displayMunicipality(pin.municipality) : '']
    .filter((part) => part.length > 0)
    .join(' · ');

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
            {units > 1
              ? `Edificio de ${units} apartamentos turísticos`
              : pin.entire
                ? 'Vivienda de uso turístico'
                : 'Vivienda turística por habitaciones'}
          </h2>
          <p className="listing-address">
            <MapPin size={17} />
            <span>
              {pin.addressText || pin.name}
              {locality && <span className="listing-address__meta">{locality}</span>}
            </span>
          </p>
          <dl className="official-spec">
            {pin.registrationCode.length > 0 && (
              <div className="official-spec__row">
                <dt>
                  <BadgeCheck size={17} aria-hidden="true" /> Licencia turística
                </dt>
                <dd>
                  <strong className="official-spec__code">{pin.registrationCode}</strong>
                </dd>
              </div>
            )}
            <div className="official-spec__row">
              <dt>
                <BedDouble size={17} aria-hidden="true" /> Capacidad
              </dt>
              <dd>{pin.places > 0 ? `${pin.places} plazas` : 'No declarada'}</dd>
            </div>
            <div className="official-spec__row">
              <dt>
                <UsersRound size={17} aria-hidden="true" /> Equivalencia
              </dt>
              <dd>
                {pin.entire ? (
                  <>
                    {units > 1 ? `${units} viviendas` : '1 vivienda'} ·{' '}
                    <strong>≈{impact.lostInhabitants} habitantes</strong>
                  </>
                ) : (
                  <>
                    <strong>≈{roomsInhabitantsForPlaces(pin.places)}</strong>{' '}
                    {roomsInhabitantsForPlaces(pin.places) === 1
                      ? 'habitante desplazado'
                      : 'habitantes desplazados'}
                  </>
                )}
              </dd>
            </div>
          </dl>
          {!pin.entire && (
            <p className="listing-note">
              Alquiler por habitaciones: no la contamos como hogar desplazado (el titular puede
              seguir residiendo), pero cada habitación alquilada a turistas es una habitación que
              deja de alquilarse a un residente de larga duración. Estimamos ≈1 habitante por
              habitación (habitaciones ≈ plazas ÷ 2).
            </p>
          )}
          <p className="official-credit">
            Fuente:{' '}
            <a href={source.registerUrl} target="_blank" rel="noopener noreferrer">
              {source.registerName}
            </a>{' '}
            ({source.publisher}), datos adaptados ·{' '}
            <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer">
              {source.licenseName}
            </a>
            {source.coordinatesCredit && (
              <>
                {' '}
                · Coordenadas:{' '}
                <a href={source.coordinatesCredit.url} target="_blank" rel="noopener noreferrer">
                  {source.coordinatesCredit.name}
                </a>{' '}
                (
                <a
                  href={source.coordinatesCredit.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.coordinatesCredit.licenseName}
                </a>
                )
              </>
            )}
            . Sin respaldo oficial.
          </p>
        </div>
      </section>
    </div>
  );
}
