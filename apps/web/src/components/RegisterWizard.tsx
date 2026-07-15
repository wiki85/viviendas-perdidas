import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Crosshair,
  Eye,
  House,
  ImageOff,
  Info,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import type {
  CreateListingInput,
  CreateListingResult,
  DuplicateSummary,
  LatLng,
  ListingType,
  SearchPlace,
} from '../domain/types';
import { useStreetView } from '../hooks/use-street-view';
import { appConfig } from '../lib/config';
import { calculateImpact } from '../lib/impact';
import { validateEvidenceNote, validateLicenseNumber } from '../lib/privacy';
import { buildStreetViewUrl } from '../lib/streetview';
import { PhotoField } from './PhotoUpload';
import { SearchBar } from './SearchBar';

type Props = {
  center: LatLng;
  pickedPosition: LatLng | null;
  mapsEnabled: boolean;
  onPlacementModeChange: (active: boolean) => void;
  onPreviewLocation: (position: LatLng) => void;
  onClose: () => void;
  onCreate: (input: CreateListingInput, photoBase64: string | null) => Promise<CreateListingResult>;
  onSelectDuplicate: (duplicate: DuplicateSummary) => void;
};

type LocationChoice = {
  position: LatLng;
  label: string;
  placeId?: string;
  source: 'map' | 'search';
};

const STEPS = ['Ubicación', 'Tipo', 'Evidencias', 'Vista previa'];

export function RegisterWizard({
  center,
  pickedPosition,
  mapsEnabled,
  onPlacementModeChange,
  onPreviewLocation,
  onClose,
  onCreate,
  onSelectDuplicate,
}: Props) {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<LocationChoice | null>(null);
  const [type, setType] = useState<ListingType>('unit');
  const [dwellingsCount, setDwellingsCount] = useState(1);
  const [commercialUnitsCount, setCommercialUnitsCount] = useState(0);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [platform, setPlatform] = useState<'' | 'airbnb' | 'booking' | 'otra'>('');
  const [note, setNote] = useState('');
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [previewHeading, setPreviewHeading] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<Extract<
    CreateListingResult,
    { created: false }
  > | null>(null);
  const {
    metadata,
    heading,
    setHeading,
    loading: streetLoading,
    error: streetError,
  } = useStreetView(location?.position ?? null);
  const noteValidation = useMemo(() => validateEvidenceNote(note), [note]);
  const licenseValidation = useMemo(() => validateLicenseNumber(licenseNumber), [licenseNumber]);
  const impact = calculateImpact(type === 'building' ? dwellingsCount : type === 'unit' ? 1 : 0);

  const locationRef = useRef<LocationChoice | null>(null);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!pickedPosition) return;
    onPlacementModeChange(false);
    const current = locationRef.current;
    // Dragging the pin after a search keeps the searched address; only the
    // exact coordinates change (misplaced anchors on pedestrian streets).
    if (current?.placeId) {
      setLocation({ ...current, position: pickedPosition });
      return;
    }
    const fallback: LocationChoice = {
      position: pickedPosition,
      label: `${pickedPosition.lat.toFixed(5)}, ${pickedPosition.lng.toFixed(5)} · dirección a verificar`,
      source: 'map',
    };
    setLocation(fallback);
    if (!mapsEnabled || !window.google?.maps) return;
    let active = true;
    void new google.maps.Geocoder()
      .geocode({ location: pickedPosition })
      .then(({ results }) => {
        if (!active || !results[0]) return;
        setLocation({ ...fallback, label: results[0].formatted_address });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mapsEnabled, onPlacementModeChange, pickedPosition]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewHeading(heading), 450);
    return () => window.clearTimeout(timeout);
  }, [heading]);

  useEffect(() => {
    setFinalConfirmed(false);
  }, [dwellingsCount, location?.position.lat, location?.position.lng, type]);

  useEffect(() => () => onPlacementModeChange(false), [onPlacementModeChange]);

  useEffect(() => {
    closeButton.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const selectSearchPlace = (place: SearchPlace) => {
    setLocation({
      position: place.position,
      label: `${place.primary}, ${place.secondary}`,
      placeId: place.placeId,
      source: 'search',
    });
    onPreviewLocation(place.position);
    onPlacementModeChange(false);
  };

  const canContinue =
    step === 0
      ? location !== null
      : step === 1
        ? type === 'unit' ||
          (type === 'building'
            ? dwellingsCount >= 1 && dwellingsCount <= 500
            : commercialUnitsCount >= 1 && commercialUnitsCount <= 50)
        : step === 2
          ? noteValidation.valid && licenseValidation.valid
          : true;

  const payload = (duplicateAcknowledged = false): CreateListingInput => {
    if (!location) throw new Error('Selecciona una ubicación.');
    return {
      type,
      dwellingsCount: type === 'building' ? dwellingsCount : 1,
      ...(type === 'building' && commercialUnitsCount > 0 ? { commercialUnitsCount } : {}),
      ...(type === 'commercial' ? { commercialUnitsCount: Math.max(1, commercialUnitsCount) } : {}),
      // Coordinates always travel: they pin the exact portal even when the
      // address anchor in Google's database is misplaced.
      location: location.position,
      ...(location.placeId ? { placeId: location.placeId } : {}),
      // The key must be absent (not undefined) when empty: the Functions SDK
      // encodes undefined as null and the server would reject the payload.
      ...(licenseNumber.trim() || platform || note.trim()
        ? {
            evidence: {
              ...(licenseNumber.trim() ? { licenseNumber: licenseNumber.trim() } : {}),
              ...(platform ? { platform } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          }
        : {}),
      streetViewHeading: metadata.available ? heading : null,
      ...(metadata.available && metadata.panoId ? { streetViewPanoId: metadata.panoId } : {}),
      duplicateAcknowledged,
    };
  };

  const submit = async (duplicateAcknowledged = false) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onCreate(
        payload(duplicateAcknowledged),
        photoBase64 && photoConsent ? photoBase64 : null,
      );
      if (!result.created) setDuplicateResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el inmueble.');
    } finally {
      setSubmitting(false);
    }
  };

  if (duplicateResult) {
    const duplicate = duplicateResult.duplicates[0];
    return (
      <div className="sheet-layer sheet-layer--wizard">
        <section
          className="bottom-sheet register-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-title"
        >
          <span className="sheet-handle" aria-hidden="true" />
          <button
            ref={closeButton}
            className="sheet-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div className="wizard-result">
            <span className="wizard-result__icon">
              <Info size={28} />
            </span>
            <p className="eyebrow">Posible duplicado</p>
            <h2 id="duplicate-title">Parece que este inmueble ya está en el mapa</h2>
            {duplicate && (
              <div className="duplicate-card">
                <strong>
                  {duplicate.type === 'building'
                    ? 'Edificio completo/parcial'
                    : 'Apartamento individual'}{' '}
                  · {duplicate.dwellingsCount} viviendas
                </strong>
                <span>{duplicate.address?.formatted ?? 'En la ubicación seleccionada'}</span>
              </div>
            )}
            <p>
              Confirmar el registro existente mejora su fiabilidad y evita inflar los contadores.
            </p>
            <button
              className="button button--primary"
              type="button"
              disabled={!duplicate}
              onClick={() => duplicate && onSelectDuplicate(duplicate)}
            >
              <Check size={18} /> Ver y confirmar el existente
            </button>
            {duplicateResult.canCreate && (
              <button
                className="button button--ghost"
                type="button"
                disabled={submitting}
                onClick={() => void submit(true)}
              >
                {type === 'unit'
                  ? 'Es otra vivienda del mismo portal'
                  : 'Registrar el edificio de todos modos'}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  const previewUrl =
    metadata.available && metadata.panoId && appConfig.googleMapsApiKey
      ? buildStreetViewUrl(appConfig.googleMapsApiKey, metadata.panoId, previewHeading)
      : null;

  return (
    <div className="sheet-layer sheet-layer--wizard">
      <section
        className="bottom-sheet register-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button
          ref={closeButton}
          className="sheet-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar registro"
        >
          <X size={20} />
        </button>
        <header className="wizard-header">
          <p className="eyebrow">Nuevo registro</p>
          <h2 id="register-title">{STEPS[step]}</h2>
          <div className="wizard-progress" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((label, index) => (
              <span key={label} className={index <= step ? 'is-active' : ''} />
            ))}
          </div>
          <p className="wizard-step-label">
            Paso {step + 1} de {STEPS.length}
          </p>
        </header>

        <div className="wizard-body">
          {step === 0 && (
            <div className="wizard-panel">
              <p>Busca la dirección o señala la puerta exacta en el mapa.</p>
              <SearchBar
                mapsEnabled={mapsEnabled}
                onSelect={selectSearchPlace}
                placeholder="Escribe una dirección…"
              />
              <div className="choice-divider">
                <span>o</span>
              </div>
              <div className="location-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => onPlacementModeChange(true)}
                >
                  <Crosshair size={18} /> Tocar en el mapa
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() =>
                    setLocation({
                      position: center,
                      label: `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)} · centro del mapa`,
                      source: 'map',
                    })
                  }
                >
                  <MapPin size={18} /> Usar el centro
                </button>
              </div>
              {location && (
                <div className="selected-location">
                  <Check size={18} />
                  <span>
                    <strong>Ubicación seleccionada</strong>
                    {location.label}
                    <small>
                      Puedes arrastrar la chincheta del mapa para afinar el portal exacto.
                    </small>
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="wizard-panel">
              <p>Indica qué parte del inmueble se destina a alojamiento turístico.</p>
              <div className="type-choices" role="radiogroup" aria-label="Tipo de inmueble">
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'unit'}
                  className={type === 'unit' ? 'is-selected' : ''}
                  onClick={() => {
                    setType('unit');
                    setDwellingsCount(1);
                    setCommercialUnitsCount(0);
                  }}
                >
                  <House />
                  <span>
                    <strong>Apartamento individual</strong>
                    <small>Una vivienda del edificio</small>
                  </span>
                  <i />
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'building'}
                  className={type === 'building' ? 'is-selected' : ''}
                  onClick={() => {
                    setType('building');
                    setCommercialUnitsCount(0);
                  }}
                >
                  <Building2 />
                  <span>
                    <strong>Edificio completo/parcial</strong>
                    <small>Dos o más viviendas del mismo portal</small>
                  </span>
                  <i />
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'commercial'}
                  className={type === 'commercial' ? 'is-selected' : ''}
                  onClick={() => {
                    setType('commercial');
                    setDwellingsCount(1);
                    setCommercialUnitsCount(1);
                  }}
                >
                  <Store />
                  <span>
                    <strong>Local comercial convertido</strong>
                    <small>Uno o varios bajos que antes eran comercio</small>
                  </span>
                  <i />
                </button>
              </div>
              {type === 'building' && (
                <>
                  <label className="field field--count">
                    <span>Número de viviendas en el edificio</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="500"
                      value={dwellingsCount}
                      onChange={(event) =>
                        setDwellingsCount(Math.max(0, Number(event.target.value)))
                      }
                    />
                    <small>Entre 1 y 500. Cuenta viviendas, no habitaciones.</small>
                  </label>
                  <label className="field field--count">
                    <span>
                      Locales comerciales eliminados <em>opcional</em>
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="50"
                      value={commercialUnitsCount}
                      onChange={(event) =>
                        setCommercialUnitsCount(
                          Math.min(50, Math.max(0, Number(event.target.value) || 0)),
                        )
                      }
                    />
                    <small>
                      Si la conversión también acabó con bajos comerciales, indícalo aquí.
                    </small>
                  </label>
                </>
              )}
              {type === 'commercial' && (
                <label className="field field--count">
                  <span>Número de locales afectados</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="50"
                    value={commercialUnitsCount}
                    onChange={(event) =>
                      setCommercialUnitsCount(
                        Math.min(50, Math.max(0, Number(event.target.value) || 0)),
                      )
                    }
                  />
                  <small>Entre 1 y 50. Varios bajos del mismo número cuentan por separado.</small>
                </label>
              )}
              <div className="impact-preview">
                <span>Impacto que se sumará</span>
                <strong>
                  {type === 'commercial'
                    ? `${commercialUnitsCount} ${commercialUnitsCount === 1 ? 'local comercial perdido' : 'locales comerciales perdidos'}`
                    : `${impact.lostFamilies} familias · ${impact.lostInhabitants} habitantes${type === 'building' && commercialUnitsCount > 0 ? ` · ${commercialUnitsCount} ${commercialUnitsCount === 1 ? 'local' : 'locales'}` : ''}`}
                </strong>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-panel">
              <div className="privacy-callout">
                <ShieldCheck size={21} />
                <span>
                  <strong>No incluyas nombres ni datos de personas.</strong> Las evidencias son
                  opcionales y públicas.
                </span>
              </div>
              <label className="field">
                <span>
                  Número de licencia turística <em>opcional</em>
                </span>
                <input
                  value={licenseNumber}
                  maxLength={80}
                  placeholder="Ej. VT-12345-V"
                  onChange={(event) => setLicenseNumber(event.target.value)}
                />
                {!licenseValidation.valid && (
                  <small className="field-error">{licenseValidation.message}</small>
                )}
              </label>
              <label className="field">
                <span>
                  Plataforma <em>opcional</em>
                </span>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as typeof platform)}
                >
                  <option value="">No lo sé</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking</option>
                  <option value="otra">Otra</option>
                </select>
              </label>
              <label className="field">
                <span>
                  Nota breve <em>opcional</em>
                </span>
                <textarea
                  value={note}
                  maxLength={280}
                  rows={3}
                  placeholder="Solo información visible sobre el inmueble…"
                  onChange={(event) => setNote(event.target.value)}
                />
                <small className={!noteValidation.valid ? 'field-error' : ''}>
                  {!noteValidation.valid ? noteValidation.message : `${note.length}/280 caracteres`}
                </small>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-panel wizard-panel--preview">
              <div className="street-preview">
                {streetLoading ? (
                  <div className="street-placeholder">
                    <LoaderCircle className="spin" />
                    <span>Buscando la fachada…</span>
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    width="400"
                    height="300"
                    alt="Vista previa de la fachada seleccionada"
                  />
                ) : (
                  <div className="street-placeholder">
                    <ImageOff size={30} />
                    <span>Sin vista de Street View en este punto</span>
                    <small>
                      Pasa en calles peatonales. Puedes añadir tu propia foto aquí abajo.
                    </small>
                  </div>
                )}
              </div>
              {metadata.available && (
                <label className="heading-control">
                  <span>
                    <Eye size={17} /> Orientación de la cámara: {heading}°
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    step="5"
                    value={heading}
                    onChange={(event) => setHeading(Number(event.target.value))}
                  />
                  <small>Mueve el control hasta encuadrar el edificio correcto.</small>
                </label>
              )}
              {streetError && <p className="form-message">{streetError}</p>}
              <PhotoField
                value={photoBase64}
                consent={photoConsent}
                onChange={setPhotoBase64}
                onConsentChange={setPhotoConsent}
              />
              <div className="final-summary">
                <strong>
                  {type === 'building'
                    ? `Edificio de ${dwellingsCount} viviendas`
                    : type === 'commercial'
                      ? commercialUnitsCount > 1
                        ? `${commercialUnitsCount} locales comerciales convertidos en turísticos`
                        : 'Local comercial convertido en turístico'
                      : 'Apartamento individual'}
                </strong>
                <span>{location?.label}</span>
                <span>
                  {type === 'commercial'
                    ? commercialUnitsCount > 1
                      ? `Se sumarán ${commercialUnitsCount} locales comerciales perdidos para el barrio.`
                      : 'Se sumará un local comercial perdido para el barrio.'
                    : `Se estiman ${impact.lostFamilies} familias y ${impact.lostInhabitants} habitantes desplazados.${type === 'building' && commercialUnitsCount > 0 ? ` Además, ${commercialUnitsCount} ${commercialUnitsCount === 1 ? 'local comercial eliminado' : 'locales comerciales eliminados'}.` : ''}`}
                </span>
              </div>
              <label className="final-check">
                <input
                  type="checkbox"
                  checked={finalConfirmed}
                  onChange={(event) => setFinalConfirmed(event.target.checked)}
                />
                <span>Confirmo que la ubicación y el número de viviendas son correctos.</span>
              </label>
            </div>
          )}
          {error && (
            <p className="form-message form-message--error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="wizard-footer">
          {step > 0 ? (
            <button
              className="button button--ghost"
              type="button"
              disabled={submitting}
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft size={18} /> Atrás
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="button button--primary"
              type="button"
              disabled={!canContinue}
              onClick={() => setStep((value) => value + 1)}
            >
              Continuar <ArrowRight size={18} />
            </button>
          ) : (
            <button
              className="button button--primary"
              type="button"
              disabled={
                submitting ||
                !location ||
                !finalConfirmed ||
                (photoBase64 !== null && !photoConsent)
              }
              onClick={() => void submit()}
            >
              {submitting ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{' '}
              {submitting ? 'Registrando…' : 'Confirmar registro'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
