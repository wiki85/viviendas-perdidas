import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, LogIn, Rss } from 'lucide-react';
import type { NewsletterPreferences } from '../domain/types';
import { cityDisplayName, COMMUNITIES, communityForCity } from '../lib/communities';
import { BrandMark } from './BrandMark';

type Props = {
  onClose: () => void;
  /** City to pre-select after sign-in (the «Suscríbete a X» map button). */
  preselectCityId?: string | null;
  signIn: () => Promise<{ email: string }>;
  loadPreferences: () => Promise<NewsletterPreferences>;
  savePreferences: (preferences: {
    scopes: string[];
    weekly: boolean;
    monthly: boolean;
  }) => Promise<void>;
  unsubscribe: () => Promise<void>;
};

const MAX_SCOPES = 12;

/**
 * «El Recuento» — subscription page. Google sign-in gives a verified email;
 * scopes are the whole map, a community or a single city. The weekly edition
 * only arrives when the subscriber's zones actually changed.
 */
export function NewsletterPage({
  onClose,
  preselectCityId = null,
  signIn,
  loadPreferences,
  savePreferences,
  unsubscribe,
}: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [scopes, setScopes] = useState<string[]>([]);
  const [weekly, setWeekly] = useState(true);
  const [monthly, setMonthly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [feedCity, setFeedCity] = useState('todo');

  useEffect(() => {
    document.title = 'El Recuento — boletín de Aquí Vivíamos';
    return () => {
      document.title = 'Aquí Vivíamos';
    };
  }, []);

  const scopeSet = useMemo(() => new Set(scopes), [scopes]);

  const toggleScope = (scope: string) => {
    setMessage(null);
    setScopes((current) => {
      if (current.includes(scope)) return current.filter((entry) => entry !== scope);
      if (scope === 'all') return ['all'];
      const next = [...current.filter((entry) => entry !== 'all'), scope];
      return next.length > MAX_SCOPES ? current : next;
    });
  };

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const account = await signIn();
      const preferences = await loadPreferences();
      setEmail(account.email);
      setSubscribed(preferences.subscribed && preferences.scopes.length > 0);
      // The map's «Suscríbete a X» button lands here: pre-check that city
      // unless an existing scope (all / its community / itself) already covers it.
      const citScope = preselectCityId ? `city:${preselectCityId}` : null;
      const community = preselectCityId ? communityForCity(preselectCityId) : null;
      const covered =
        citScope === null ||
        preferences.scopes.includes('all') ||
        preferences.scopes.includes(citScope) ||
        (community !== null && preferences.scopes.includes(`community:${community.id}`));
      setScopes(
        covered || citScope === null ? preferences.scopes : [...preferences.scopes, citScope],
      );
      setWeekly(preferences.weekly);
      setMonthly(preferences.monthly);
    } catch {
      setMessage({
        kind: 'error',
        text: 'No se pudo iniciar sesión. Inténtalo de nuevo en unos segundos.',
      });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (scopes.length === 0) {
      setMessage({
        kind: 'error',
        text: 'Elige al menos una zona (una ciudad, una comunidad o todo el mapa).',
      });
      return;
    }
    if (!weekly && !monthly) {
      setMessage({ kind: 'error', text: 'Elige al menos una frecuencia: semanal o mensual.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await savePreferences({ scopes, weekly, monthly });
      setSubscribed(true);
      setMessage({
        kind: 'ok',
        text: 'Suscripción guardada. La próxima edición llegará a tu correo.',
      });
    } catch {
      setMessage({ kind: 'error', text: 'No se pudo guardar. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribe();
      setSubscribed(false);
      setMessage({ kind: 'ok', text: 'Baja completada. Puedes volver cuando quieras.' });
    } catch {
      setMessage({ kind: 'error', text: 'No se pudo completar la baja. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="about-page stats-page newsletter-page">
      <nav className="about-page__nav">
        <button className="button button--ghost" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al mapa
        </button>
        <BrandMark />
      </nav>
      <article className="about-page__article stats-page__article">
        <p className="eyebrow">El Recuento</p>
        <h1>El boletín de datos de Aquí Vivíamos</h1>
        <p className="stats-page__intro">
          Cada semana sincronizamos los registros oficiales de turismo. El Recuento te cuenta
          cuántas viviendas turísticas se sumaron o se retiraron en las zonas que elijas, con cifras
          citables. Sin cambios, no hay correo: solo escribimos cuando hay algo que contar.
        </p>

        {email === null ? (
          <section className="newsletter-signin">
            <p>
              Para suscribirte necesitamos un correo verificado. Solo usamos tu dirección para
              enviarte el boletín; la baja es de un clic desde cualquier edición.
            </p>
            <button
              className="button button--primary"
              type="button"
              disabled={busy}
              onClick={() => void start()}
            >
              <LogIn size={18} /> {busy ? 'Conectando…' : 'Continuar con Google'}
            </button>
          </section>
        ) : (
          <section className="newsletter-preferences">
            <p className="newsletter-account">
              Suscripción para <strong>{email}</strong>
              {subscribed ? ' · activa' : ' · sin activar'}
            </p>

            <h2>¿Qué zonas quieres seguir?</h2>
            <div className="newsletter-scopes">
              <label className="newsletter-scope newsletter-scope--all">
                <input
                  type="checkbox"
                  checked={scopeSet.has('all')}
                  onChange={() => toggleScope('all')}
                />
                Todo el mapa (España)
              </label>
              {COMMUNITIES.map((community) => (
                <fieldset key={community.id} className="newsletter-community">
                  <legend>
                    <label className="newsletter-scope">
                      <input
                        type="checkbox"
                        checked={scopeSet.has(`community:${community.id}`)}
                        disabled={scopeSet.has('all')}
                        onChange={() => toggleScope(`community:${community.id}`)}
                      />
                      {community.name}
                    </label>
                  </legend>
                  <div className="newsletter-cities">
                    {community.cityIds.map((cityId) => (
                      <label key={cityId} className="newsletter-scope">
                        <input
                          type="checkbox"
                          checked={scopeSet.has(`city:${cityId}`)}
                          disabled={
                            scopeSet.has('all') || scopeSet.has(`community:${community.id}`)
                          }
                          onChange={() => toggleScope(`city:${cityId}`)}
                        />
                        {cityDisplayName(cityId)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            <h2>¿Con qué frecuencia?</h2>
            <div className="newsletter-frequency">
              <label className="newsletter-scope">
                <input type="checkbox" checked={weekly} onChange={() => setWeekly(!weekly)} />
                Semanal (lunes, solo si hay cambios)
              </label>
              <label className="newsletter-scope">
                <input type="checkbox" checked={monthly} onChange={() => setMonthly(!monthly)} />
                Mensual (día 1, resumen del mes)
              </label>
            </div>

            {message && (
              <p role="status" className={`newsletter-message newsletter-message--${message.kind}`}>
                {message.text}
              </p>
            )}

            <div className="newsletter-actions">
              <button
                className="button button--primary"
                type="button"
                disabled={busy}
                onClick={() => void save()}
              >
                <Check size={18} /> {busy ? 'Guardando…' : 'Guardar suscripción'}
              </button>
              {subscribed && (
                <button
                  className="button button--report"
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                >
                  Darse de baja
                </button>
              )}
            </div>
          </section>
        )}

        {email === null && message && (
          <p role="status" className={`newsletter-message newsletter-message--${message.kind}`}>
            {message.text}
          </p>
        )}

        <section className="newsletter-feeds">
          <h2>
            <Rss size={18} /> Feeds RSS para asociaciones y periodistas
          </h2>
          <p>
            Los mismos datos, sin correo ni registro: cada variación del recuento oficial es una
            entrada del feed. Útil para lectores RSS, redacciones y automatizaciones.
          </p>
          <div className="stats-filters" role="group" aria-label="Elegir feed">
            <label>
              Ámbito
              <select value={feedCity} onChange={(event) => setFeedCity(event.target.value)}>
                <option value="todo">Todo el mapa (España)</option>
                {COMMUNITIES.flatMap((community) => community.cityIds).map((cityId) => (
                  <option key={cityId} value={cityId}>
                    {cityDisplayName(cityId)}
                  </option>
                ))}
              </select>
            </label>
            <a className="button button--primary" href={`/feeds/${feedCity}.xml`}>
              Abrir feed
            </a>
          </div>
          <p className="stats-page__sources">
            ¿Eres periodista o representas a una asociación? En la{' '}
            <a href="/prensa">página de prensa</a> explicamos cómo insertar los feeds en vuestra
            web, automatizar alertas y citar los datos.
          </p>
          <p className="stats-page__sources">
            Datos de los registros oficiales autonómicos de turismo (CC BY 4.0); fuentes y licencias
            en la metodología. Ninguna administración respalda este proyecto.
          </p>
        </section>
      </article>
    </main>
  );
}
