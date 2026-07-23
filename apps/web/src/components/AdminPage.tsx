import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ImageOff,
  Landmark,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ErrorLogEntry,
  Listing,
  ListingsService,
  ListingType,
  PendingPhoto,
  PhotoDecision,
} from '../domain/types';
import { BrandMark } from './BrandMark';
import { encodeJpegBase64 } from './PhotoUpload';

type Props = {
  service: ListingsService;
  onClose: () => void;
};

type Tab = 'photos' | 'listings' | 'errors';

function prettyDetails(details: string): string {
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

function describeError(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = String((cause as { code: unknown }).code);
    if (code.includes('permission-denied')) {
      return 'Esta cuenta de Google no tiene permisos de moderación.';
    }
    if (code.includes('unauthenticated')) return 'Vuelve a iniciar sesión para continuar.';
  }
  return cause instanceof Error ? cause.message : 'Algo ha fallado. Inténtalo de nuevo.';
}

function typeLabel(type: ListingType): string {
  return type === 'building'
    ? 'Edificio'
    : type === 'commercial'
      ? 'Local comercial'
      : 'Apartamento';
}

export function AdminPage({ service, onClose }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('photos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PendingPhoto[] | null>(null);
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [filter, setFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [onlyOfficialMatches, setOnlyOfficialMatches] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<ErrorLogEntry[] | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { type: ListingType; dwellings: number; locales: number }>
  >({});
  const photoTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPhotos(await service.listPendingPhotos());
    } catch (cause) {
      setError(describeError(cause));
      setPhotos(null);
    } finally {
      setLoading(false);
    }
  }, [service]);

  const refreshListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setListings(await service.adminListListings());
      setDrafts({});
    } catch (cause) {
      setError(describeError(cause));
      setListings(null);
    } finally {
      setLoading(false);
    }
  }, [service]);

  const refreshErrors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setErrors(await service.adminListErrors());
    } catch (cause) {
      setError(describeError(cause));
      setErrors(null);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (email === null) return;
    if (tab === 'photos') void refreshPhotos();
    else if (tab === 'listings') void refreshListings();
    else void refreshErrors();
  }, [email, refreshErrors, refreshListings, refreshPhotos, tab]);

  useEffect(() => {
    if (!photos) return;
    for (const photo of photos) {
      if (images[photo.id] !== undefined) continue;
      setImages((current) => ({ ...current, [photo.id]: null }));
      void service
        .getPendingPhotoImage(photo.id)
        .then((dataUrl) => setImages((current) => ({ ...current, [photo.id]: dataUrl })))
        .catch(() => undefined);
    }
  }, [images, photos, service]);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await service.adminSignIn();
      if (!session.moderator) {
        // The service already signed the account out; show the single
        // "no permissions" screen instead of the (empty) panel.
        setDeniedEmail(session.email);
        return;
      }
      setEmail(session.email);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  };

  const review = async (photo: PendingPhoto, decision: PhotoDecision) => {
    setBusyId(photo.id);
    setError(null);
    try {
      await service.reviewListingPhoto(photo.id, decision);
      setPhotos((current) => current?.filter((entry) => entry.id !== photo.id) ?? null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const draftFor = (listing: Listing) =>
    drafts[listing.id] ?? {
      type: listing.type,
      dwellings: listing.dwellingsCount,
      locales: listing.commercialUnitsCount ?? (listing.type === 'commercial' ? 1 : 0),
    };

  const setDraft = (
    listing: Listing,
    patch: Partial<{ type: ListingType; dwellings: number; locales: number }>,
  ) => setDrafts((current) => ({ ...current, [listing.id]: { ...draftFor(listing), ...patch } }));

  const draftChanged = (listing: Listing) => {
    const draft = draftFor(listing);
    return (
      draft.type !== listing.type ||
      draft.dwellings !== listing.dwellingsCount ||
      draft.locales !== (listing.commercialUnitsCount ?? (listing.type === 'commercial' ? 1 : 0))
    );
  };

  const saveListing = async (listing: Listing) => {
    const draft = draftFor(listing);
    const dwellingsCount = draft.type === 'building' ? Math.max(1, draft.dwellings) : 1;
    const commercialUnitsCount =
      draft.type === 'building'
        ? Math.max(0, draft.locales)
        : draft.type === 'commercial'
          ? Math.max(1, draft.locales)
          : 0;
    setBusyId(listing.id);
    setError(null);
    try {
      await service.adminUpdateListing(listing.id, {
        type: draft.type,
        dwellingsCount,
        commercialUnitsCount,
      });
      setListings(
        (current) =>
          current?.map((entry) =>
            entry.id === listing.id
              ? { ...entry, type: draft.type, dwellingsCount, commercialUnitsCount }
              : entry,
          ) ?? null,
      );
      setDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => key !== listing.id)),
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const resolveOfficialMatch = async (listing: Listing) => {
    setBusyId(listing.id);
    setError(null);
    try {
      await service.adminResolveOfficialMatch(listing.id);
      setListings(
        (current) =>
          current?.map((entry) =>
            entry.id === listing.id && entry.officialMatch
              ? { ...entry, officialMatch: { ...entry.officialMatch, reviewStatus: 'reviewed' } }
              : entry,
          ) ?? null,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const syncOfficialData = async () => {
    setSyncing(true);
    setError(null);
    try {
      const summary = await service.adminSyncOfficialData();
      setError(
        `Sincronización completada: ${summary.records.toLocaleString('es-ES')} registros oficiales en ${summary.municipalities} municipios.`,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSyncing(false);
    }
  };

  const deleteListing = async (listing: Listing) => {
    const confirmed = window.confirm(
      `¿Eliminar el registro de ${listing.address.formatted}? Los contadores se revertirán y dejará de mostrarse en el mapa.`,
    );
    if (!confirmed) return;
    setBusyId(listing.id);
    setError(null);
    try {
      await service.adminDeleteListing(listing.id);
      setListings(
        (current) =>
          current?.map((entry) =>
            entry.id === listing.id ? { ...entry, status: 'removed' as const } : entry,
          ) ?? null,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const removePhoto = async (listing: Listing) => {
    setBusyId(listing.id);
    setError(null);
    try {
      await service.adminSetListingPhoto(listing.id, null);
      setListings(
        (current) =>
          current?.map((entry) => (entry.id === listing.id ? { ...entry, photo: null } : entry)) ??
          null,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const pickReplacementPhoto = (listing: Listing) => {
    photoTarget.current = listing.id;
    fileInput.current?.click();
  };

  const replacePhoto = async (file: File | undefined) => {
    const listingId = photoTarget.current;
    photoTarget.current = null;
    if (!file || !listingId) return;
    setBusyId(listingId);
    setError(null);
    try {
      const imageBase64 = await encodeJpegBase64(file);
      await service.adminSetListingPhoto(listingId, imageBase64);
      await refreshListings();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  const cityOptions = [
    ...new Map(
      (listings ?? []).map((listing) => [
        listing.cityId || listing.address.locality,
        listing.address.locality || listing.cityId,
      ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], 'es'));

  const filteredListings = (listings ?? []).filter((listing) => {
    if (cityFilter && (listing.cityId || listing.address.locality) !== cityFilter) return false;
    if (onlyOfficialMatches && listing.officialMatch?.reviewStatus !== 'pending') return false;
    const needle = filter.trim().toLocaleLowerCase('es');
    if (!needle) return true;
    return (
      listing.address.formatted.toLocaleLowerCase('es').includes(needle) ||
      listing.address.postalCode.startsWith(needle)
    );
  });
  const pendingOfficialCount = (listings ?? []).filter(
    (listing) => listing.officialMatch?.reviewStatus === 'pending',
  ).length;

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <button className="icon-button" type="button" onClick={onClose} aria-label="Volver al mapa">
          <ArrowLeft size={20} />
        </button>
        <BrandMark />
        <span className="admin-page__tag">
          <ShieldCheck size={16} /> Moderación
        </span>
      </header>

      {deniedEmail !== null ? (
        <section className="admin-page__gate">
          <h1>Esta cuenta no tiene permisos</h1>
          <p>
            La moderación de Viviendas Perdidas está reservada a cuentas autorizadas.
            <strong> {deniedEmail}</strong> no está en esa lista y la sesión se ha cerrado.
          </p>
          <button className="button button--confirm" type="button" onClick={onClose}>
            <ArrowLeft size={17} /> Volver al mapa
          </button>
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setDeniedEmail(null);
              void signIn();
            }}
          >
            Probar con otra cuenta
          </button>
        </section>
      ) : email === null ? (
        <section className="admin-page__gate">
          <h1>Panel de administración</h1>
          <p>
            Revisa fotos pendientes y gestiona los registros existentes con una cuenta autorizada.
          </p>
          <button
            className="button button--confirm"
            type="button"
            disabled={loading}
            onClick={() => void signIn()}
          >
            {loading ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}
            Entrar con Google
          </button>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <section className="admin-page__queue">
          <div className="admin-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'photos'}
              className={tab === 'photos' ? 'is-active' : ''}
              onClick={() => setTab('photos')}
            >
              Fotos pendientes {photos ? `(${photos.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'listings'}
              className={tab === 'listings' ? 'is-active' : ''}
              onClick={() => setTab('listings')}
            >
              Registros {listings ? `(${listings.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'errors'}
              className={tab === 'errors' ? 'is-active' : ''}
              onClick={() => setTab('errors')}
            >
              Errores {errors ? `(${errors.length})` : ''}
            </button>
            <div className="admin-tabs__side">
              <span className="admin-page__email">{email}</span>
              <button
                className="icon-button"
                type="button"
                onClick={() =>
                  tab === 'photos'
                    ? void refreshPhotos()
                    : tab === 'listings'
                      ? void refreshListings()
                      : void refreshErrors()
                }
                disabled={loading}
                aria-label="Recargar"
                title="Recargar"
              >
                <RefreshCw size={18} className={loading ? 'spin' : undefined} />
              </button>
            </div>
          </div>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}

          {tab === 'photos' && (
            <>
              {photos && photos.length === 0 && !loading && (
                <p className="admin-page__empty">No hay fotos pendientes. Todo revisado ✔</p>
              )}
              <ul className="admin-page__list">
                {(photos ?? []).map((photo) => {
                  const imageDataUrl = images[photo.id];
                  return (
                    <li key={photo.id} className="admin-card">
                      {imageDataUrl ? (
                        <img src={imageDataUrl} alt={`Foto pendiente en ${photo.listingAddress}`} />
                      ) : (
                        <div className="admin-card__placeholder">
                          {images[photo.id] === null ? (
                            <LoaderCircle className="spin" size={22} />
                          ) : (
                            <ImageOff size={22} />
                          )}
                        </div>
                      )}
                      <div className="admin-card__body">
                        <strong>{photo.listingAddress}</strong>
                        <small>
                          Enviada el{' '}
                          {new Date(photo.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </small>
                        <div className="admin-card__actions">
                          <button
                            className="button button--confirm"
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void review(photo, 'approve')}
                          >
                            <Check size={17} />
                            {busyId === photo.id ? 'Guardando…' : 'Aprobar y publicar'}
                          </button>
                          <button
                            className="button button--report"
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void review(photo, 'reject')}
                          >
                            <X size={17} /> Rechazar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'listings' && (
            <>
              <div className="admin-filters">
                <select
                  className="admin-filter admin-filter--city"
                  value={cityFilter}
                  aria-label="Filtrar por ciudad"
                  onChange={(event) => setCityFilter(event.target.value)}
                >
                  <option value="">Todas las ciudades</option>
                  {cityOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-filter"
                  type="search"
                  placeholder="Dirección o código postal…"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </div>
              <div className="admin-official-bar">
                <label className="admin-official-toggle">
                  <input
                    type="checkbox"
                    checked={onlyOfficialMatches}
                    onChange={(event) => setOnlyOfficialMatches(event.target.checked)}
                  />
                  Solo posibles duplicados oficiales
                  {pendingOfficialCount > 0 && (
                    <span className="admin-official-count">{pendingOfficialCount}</span>
                  )}
                </label>
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={syncing}
                  onClick={() => void syncOfficialData()}
                >
                  {syncing ? <LoaderCircle className="spin" size={16} /> : <Landmark size={16} />}
                  Sincronizar registro oficial
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void replacePhoto(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {listings && filteredListings.length === 0 && !loading && (
                <p className="admin-page__empty">Sin registros que coincidan.</p>
              )}
              <ul className="admin-page__list">
                {filteredListings.map((listing) => {
                  const draft = draftFor(listing);
                  const removed = listing.status === 'removed';
                  const busy = busyId === listing.id;
                  return (
                    <li
                      key={listing.id}
                      className={`admin-card admin-card--listing ${removed ? 'is-removed' : ''}`}
                    >
                      <div className="admin-card__body">
                        <div className="admin-listing__head">
                          {listing.photo?.url ? (
                            <img
                              className="admin-listing__thumb"
                              src={listing.photo.url}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span className="admin-listing__thumb admin-listing__thumb--empty">
                              <ImageOff size={17} />
                            </span>
                          )}
                          <div>
                            <strong>{listing.address.formatted}</strong>
                            {listing.officialMatch?.reviewStatus === 'pending' && (
                              <span className="admin-official-flag">
                                <Landmark size={13} /> Posible duplicado oficial (
                                {listing.officialMatch.registrationCode})
                              </span>
                            )}
                            <small>
                              {typeLabel(listing.type)} ·{' '}
                              {listing.type === 'commercial'
                                ? `${Math.max(1, listing.commercialUnitsCount ?? 1)} ${(listing.commercialUnitsCount ?? 1) > 1 ? 'locales' : 'local'}`
                                : `${listing.dwellingsCount} ${listing.dwellingsCount === 1 ? 'unidad' : 'viviendas'}`}{' '}
                              ·{' '}
                              {removed
                                ? 'Eliminado'
                                : listing.status === 'flagged'
                                  ? 'En revisión'
                                  : 'Activo'}{' '}
                              · {listing.confirmations} ✓ / {listing.reports} ⚑
                            </small>
                          </div>
                        </div>
                        {!removed && (
                          <>
                            <div className="admin-listing__edit">
                              <label>
                                <span>Tipo</span>
                                <select
                                  value={draft.type}
                                  disabled={busy}
                                  onChange={(event) =>
                                    setDraft(listing, {
                                      type: event.target.value as ListingType,
                                      ...(event.target.value !== 'building'
                                        ? { dwellings: 1 }
                                        : {}),
                                      ...(event.target.value === 'commercial'
                                        ? { locales: Math.max(1, draft.locales) }
                                        : event.target.value === 'unit'
                                          ? { locales: 0 }
                                          : {}),
                                    })
                                  }
                                >
                                  <option value="unit">Apartamento</option>
                                  <option value="building">Edificio completo/parcial</option>
                                  <option value="commercial">Local comercial</option>
                                </select>
                              </label>
                              <label>
                                <span>Viviendas</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="500"
                                  value={draft.dwellings}
                                  disabled={busy || draft.type !== 'building'}
                                  onChange={(event) =>
                                    setDraft(listing, {
                                      dwellings: Math.max(1, Number(event.target.value) || 1),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                <span>Locales</span>
                                <input
                                  type="number"
                                  min={draft.type === 'commercial' ? 1 : 0}
                                  max="50"
                                  value={draft.locales}
                                  disabled={busy || draft.type === 'unit'}
                                  onChange={(event) =>
                                    setDraft(listing, {
                                      locales: Math.min(
                                        50,
                                        Math.max(
                                          draft.type === 'commercial' ? 1 : 0,
                                          Number(event.target.value) || 0,
                                        ),
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <button
                                className="button button--confirm"
                                type="button"
                                disabled={busy || !draftChanged(listing)}
                                onClick={() => void saveListing(listing)}
                              >
                                {busy ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : (
                                  <Save size={16} />
                                )}
                                Guardar
                              </button>
                            </div>
                            <div className="admin-card__actions admin-card__actions--wrap">
                              <button
                                className="button button--ghost"
                                type="button"
                                disabled={busy}
                                onClick={() => pickReplacementPhoto(listing)}
                              >
                                <Camera size={16} />
                                {listing.photo?.url ? 'Reemplazar foto' : 'Añadir foto'}
                              </button>
                              {listing.photo?.url && (
                                <button
                                  className="button button--ghost"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void removePhoto(listing)}
                                >
                                  <ImageOff size={16} /> Quitar foto
                                </button>
                              )}
                              {listing.officialMatch?.reviewStatus === 'pending' && (
                                <button
                                  className="button button--ghost"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void resolveOfficialMatch(listing)}
                                >
                                  <Check size={16} /> Marcar revisado
                                </button>
                              )}
                              <button
                                className="button button--report"
                                type="button"
                                disabled={busy}
                                onClick={() => void deleteListing(listing)}
                              >
                                <Trash2 size={16} /> Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'errors' && (
            <>
              <p className="admin-page__hint">
                Fallos del servidor de los últimos 30 días. Los usuarios solo ven mensajes
                genéricos; el detalle completo queda aquí.
              </p>
              {errors && errors.length === 0 && !loading && (
                <p className="admin-page__empty">Sin errores registrados ✔</p>
              )}
              <ul className="admin-page__list">
                {(errors ?? []).map((entry) => (
                  <li key={entry.id} className="admin-card">
                    <div className="admin-card__body">
                      <div className="admin-error__meta">
                        <strong>{entry.action}</strong>
                        <span className="admin-error__kind">{entry.kind}</span>
                        <small>
                          {new Date(entry.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'medium',
                          })}
                        </small>
                      </div>
                      <pre className="admin-error__details">{prettyDetails(entry.details)}</pre>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
