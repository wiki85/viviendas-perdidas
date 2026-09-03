import { useState } from 'react';
import {
  Building2,
  CalendarDays,
  BadgeCheck,
  Check,
  Flag,
  House,
  ImageOff,
  Landmark,
  MapPin,
  ShieldAlert,
  Store,
} from 'lucide-react';
import type { Listing, VoteKind } from '../domain/types';
import { appConfig } from '../lib/config';
import { calculateImpact, formatListingDate } from '../lib/impact';
import { buildStreetViewUrl } from '../lib/streetview';
import { Sheet } from './Sheet';

type Props = {
  listing: Listing;
  onClose: () => void;
  onVote: (kind: VoteKind) => Promise<void>;
};

export function ListingSheet({ listing, onClose, onVote }: Props) {
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
    <Sheet
      variant="panel"
      labelledBy="listing-title"
      onClose={onClose}
      closeLabel="Cerrar ficha"
      className="listing-sheet"
    >
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
            <ImageOff size={28} aria-hidden="true" />
            <span>Sin imagen de Street View</span>
            <small>El registro sigue siendo válido</small>
          </div>
        )}
        <span className={`listing-badge listing-badge--${listing.type}`}>
          {listing.type === 'building' ? (
            <Building2 size={15} aria-hidden="true" />
          ) : listing.type === 'commercial' ? (
            <Store size={15} aria-hidden="true" />
          ) : (
            <House size={15} aria-hidden="true" />
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
      <div className="sheet__body">
        {listing.status === 'flagged' && (
          <div className="review-notice" role="status">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>
              <strong>En revisión comunitaria.</strong> Hay dudas sobre este registro.
            </span>
          </div>
        )}
        <h2 id="listing-title" className="sheet__title">
          {listing.type === 'commercial'
            ? commercialCount === 1
              ? 'Local comercial perdido'
              : `${commercialCount} locales comerciales perdidos`
            : `${listing.dwellingsCount} ${listing.dwellingsCount === 1 ? 'vivienda perdida' : 'viviendas perdidas'}`}
        </h2>
        <p className="listing-address">
          <MapPin size={17} aria-hidden="true" /> <span>{listing.address.formatted}</span>
        </p>
        {listing.type === 'commercial' ? (
          <div className="facts">
            <div className="fact">
              <span className="fact__label">Aquí había</span>
              <strong className="fact__value">
                {commercialCount === 1
                  ? 'un comercio de barrio'
                  : `${commercialCount} comercios de barrio`}
              </strong>
            </div>
            <div className="fact">
              <span className="fact__label">Ahora es</span>
              <strong className="fact__value">alojamiento turístico</strong>
            </div>
          </div>
        ) : (
          <div className="facts">
            <div className="fact">
              <span className="fact__label">Aquí vivían aprox.</span>
              <strong className="fact__value">
                {impact.lostFamilies} {impact.lostFamilies === 1 ? 'familia' : 'familias'}
              </strong>
            </div>
            <div className="fact">
              <span className="fact__label">Equivale a unas</span>
              <strong className="fact__value">{impact.lostInhabitants} personas</strong>
            </div>
          </div>
        )}
        <div className="listing-meta">
          <span>
            <CalendarDays size={16} aria-hidden="true" /> Registrado el{' '}
            {formatListingDate(listing.createdAt)}
          </span>
          {listing.type === 'building' && (listing.commercialUnitsCount ?? 0) > 0 && (
            <span>
              <Store size={16} aria-hidden="true" /> {listing.commercialUnitsCount}{' '}
              {listing.commercialUnitsCount === 1
                ? 'local comercial eliminado'
                : 'locales comerciales eliminados'}
            </span>
          )}
          {listing.licenseVerified && (
            <span className="listing-verified">
              <BadgeCheck size={16} aria-hidden="true" /> Licencia verificada en el registro oficial
            </span>
          )}
          {listing.officialMatch && (
            <span className="listing-verified">
              <Landmark size={16} aria-hidden="true" /> Figura en el registro oficial de turismo (
              {listing.officialMatch.registrationCode})
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
        <div className="vote-actions" role="group" aria-label="Validación comunitaria">
          <button
            className="button button--confirm"
            type="button"
            disabled={busy !== null || voted}
            onClick={() => void vote('confirm')}
          >
            <Check size={18} aria-hidden="true" />{' '}
            {busy === 'confirm' ? 'Guardando…' : 'Confirmo que existe'}
          </button>
          <button
            className="button button--report"
            type="button"
            disabled={busy !== null || voted}
            onClick={() => void vote('report')}
          >
            <Flag size={16} aria-hidden="true" />{' '}
            {busy === 'report' ? 'Guardando…' : 'Reportar error'}
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
    </Sheet>
  );
}
