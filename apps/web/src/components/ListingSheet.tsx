import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  Flag,
  House,
  ImageOff,
  MapPin,
  ShieldAlert,
  Store,
  UsersRound,
  X,
} from 'lucide-react';
import type { Listing, VoteKind } from '../domain/types';
import { appConfig } from '../lib/config';
import { calculateImpact, formatListingDate } from '../lib/impact';
import { buildStreetViewUrl } from '../lib/streetview';

type Props = {
  listing: Listing;
  onClose: () => void;
  onVote: (kind: VoteKind) => Promise<void>;
};

export function ListingSheet({ listing, onClose, onVote }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [voted, setVoted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const impact = calculateImpact(listing.dwellingsCount);
  // Legacy commercial listings stored 0 locales but always counted as 1.
  const commercialCount =
    listing.type === 'commercial' ? Math.max(1, listing.commercialUnitsCount ?? 1) : 0;
  const communityPhotoUrl = listing.photo?.url ?? null;
  const streetViewUrl =
    listing.streetView.available && listing.streetView.panoId && appConfig.googleMapsApiKey
      ? buildStreetViewUrl(
          appConfig.googleMapsApiKey,
          listing.streetView.panoId,
          listing.streetView.heading ?? 0,
        )
      : null;
  const photoUrl = communityPhotoUrl ?? streetViewUrl;

  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const vote = async (kind: VoteKind) => {
    setBusy(kind);
    setMessage(null);
    try {
      await onVote(kind);
      setVoted(true);
      setMessage(
        kind === 'confirm'
          ? 'Gracias. Tu confirmación ya cuenta.'
          : 'Gracias. Revisaremos este registro entre todos.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar tu voto.');
    } finally {
      setBusy(null);
    }
  };

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
        aria-labelledby="listing-title"
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
        <div className="listing-sheet__photo">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Vista de la fachada en ${listing.address.formatted}`}
              width="400"
              height="300"
            />
          ) : (
            <div className="street-placeholder">
              <ImageOff size={28} />
              <span>Sin imagen de Street View</span>
              <small>El registro sigue siendo válido</small>
            </div>
          )}
          <span className={`listing-badge listing-badge--${listing.type}`}>
            {listing.type === 'building' ? (
              <Building2 size={15} />
            ) : listing.type === 'commercial' ? (
              <Store size={15} />
            ) : (
              <House size={15} />
            )}
            {listing.type === 'building'
              ? 'Edificio completo/parcial'
              : listing.type === 'commercial'
                ? 'Local comercial convertido'
                : 'Apartamento individual'}
          </span>
          {communityPhotoUrl && (
            <span className="listing-badge listing-badge--community">Foto de la comunidad</span>
          )}
        </div>
        <div className="listing-sheet__body">
          {listing.status === 'flagged' && (
            <div className="review-notice" role="status">
              <ShieldAlert size={18} />
              <span>
                <strong>En revisión comunitaria.</strong> Hay dudas sobre este registro.
              </span>
            </div>
          )}
          <h2 id="listing-title">
            {listing.type === 'commercial'
              ? commercialCount === 1
                ? 'Local comercial perdido'
                : `${commercialCount} locales comerciales perdidos`
              : `${listing.dwellingsCount} ${listing.dwellingsCount === 1 ? 'vivienda perdida' : 'viviendas perdidas'}`}
          </h2>
          <p className="listing-address">
            <MapPin size={17} /> {listing.address.formatted}
          </p>
          {listing.type === 'commercial' ? (
            <div className="impact-callout">
              <div>
                <Store size={19} />
                <span>Aquí había</span>
                <strong>
                  {commercialCount === 1
                    ? 'un comercio de barrio'
                    : `${commercialCount} comercios de barrio`}
                </strong>
              </div>
              <div>
                <span className="person-glyph" aria-hidden="true">
                  ●
                </span>
                <span>Ahora es</span>
                <strong>alojamiento turístico</strong>
              </div>
            </div>
          ) : (
            <div className="impact-callout">
              <div>
                <UsersRound size={19} />
                <span>Aquí vivían aprox.</span>
                <strong>
                  {impact.lostFamilies} {impact.lostFamilies === 1 ? 'familia' : 'familias'}
                </strong>
              </div>
              <div>
                <span className="person-glyph" aria-hidden="true">
                  ●
                </span>
                <span>Equivale a unas</span>
                <strong>{impact.lostInhabitants} personas</strong>
              </div>
            </div>
          )}
          <div className="listing-meta">
            <span>
              <CalendarDays size={15} /> Registrado el {formatListingDate(listing.createdAt)}
            </span>
            {listing.type === 'building' && (listing.commercialUnitsCount ?? 0) > 0 && (
              <span>
                <Store size={15} /> {listing.commercialUnitsCount}{' '}
                {listing.commercialUnitsCount === 1
                  ? 'local comercial eliminado'
                  : 'locales comerciales eliminados'}
              </span>
            )}
            {listing.evidence.licenseNumber && (
              <span>Licencia: {listing.evidence.licenseNumber}</span>
            )}
            {listing.evidence.platform && (
              <span>Plataforma indicada: {listing.evidence.platform}</span>
            )}
          </div>
          {listing.evidence.note && <p className="listing-note">“{listing.evidence.note}”</p>}
          <div className="vote-actions" aria-label="Validación comunitaria">
            <button
              className="button button--confirm"
              type="button"
              disabled={busy !== null || voted}
              onClick={() => void vote('confirm')}
            >
              <Check size={19} /> {busy === 'confirm' ? 'Guardando…' : 'Confirmo que existe'}
            </button>
            <button
              className="button button--report"
              type="button"
              disabled={busy !== null || voted}
              onClick={() => void vote('report')}
            >
              <Flag size={17} /> {busy === 'report' ? 'Guardando…' : 'Reportar error'}
            </button>
          </div>
          <p className="vote-tally">
            {listing.confirmations} confirmaciones · {listing.reports} reportes
          </p>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
