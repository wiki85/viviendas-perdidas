import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, LogIn, LogOut, Mail, Rss } from 'lucide-react';
import type { NewsletterPreferences, PrepareAuthResult, SignInOutcome } from '../domain/types';
import { AuthFlowError } from '../lib/auth-errors';
import { cityDisplayName, COMMUNITIES, communityForCity } from '../lib/communities';
import { BrandMark } from './BrandMark';

type Props = {
  onClose: () => void;
  /** City to pre-select after sign-in (the «Suscríbete a X» map button). */
  preselectCityId?: string | null;
  prepareAuth: () => Promise<PrepareAuthResult>;
  signIn: () => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
  sendLoginLink: (email: string) => Promise<void>;
  completeEmailLink: (email: string) => Promise<SignInOutcome>;
  loadPreferences: () => Promise<NewsletterPreferences>;
  savePreferences: (preferences: {
    scopes: string[];
    weekly: boolean;
    monthly: boolean;
  }) => Promise<void>;
  unsubscribe: () => Promise<void>;
};

const MAX_SCOPES = 12;

function authErrorText(cause: unknown): string {
  return cause instanceof AuthFlowError
    ? cause.message
    : 'No se pudo iniciar sesión. Inténtalo de nuevo en unos segundos.';
}

/**
 * «El Recuento» — subscription page. Sign-in (Google or an emailed magic
 * link) gives a verified email; scopes are the whole map, a community or a
 * single city. The weekly edition only arrives when the subscriber's zones
 * actually changed.
 */
export function NewsletterPage({
  onClose,
  preselectCityId = null,
  prepareAuth,
  signIn,
  signOut,
  sendLoginLink,
  completeEmailLink,
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
  const [checking, setChecking] = useState(true);
  /** Magic link opened on a device other than the one that requested it. */
  const [pendingLinkEmail, setPendingLinkEmail] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkState, setLinkState] = useState<'idle' | 'sending' | 'sent'>('idle');
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

  const applyPreferences = (preferences: NewsletterPreferences) => {
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
  };

  /** Signed in: load preferences. A failure here is NOT a sign-in failure. */
  const enter = async (accountEmail: string) => {
    try {
      const preferences = await loadPreferences();
      applyPreferences(preferences);
      setPendingLinkEmail(false);
      setEmail(accountEmail);
    } catch {
      setMessage({
        kind: 'error',
        text: `Tu sesión como ${accountEmail} está iniciada, pero no se pudieron cargar tus preferencias. Inténtalo de nuevo.`,
      });
    }
  };

  // Resolves the pending session once per mount: a persisted session after a
  // reload, a sign-in redirect return, or a magic link landing.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      try {
        const pending = await prepareAuth();
        if (pending.kind === 'session') await enter(pending.email);
        else if (pending.kind === 'emailLinkPendingEmail') setPendingLinkEmail(true);
      } catch (cause) {
        setMessage({ kind: 'error', text: authErrorText(cause) });
      } finally {
        setChecking(false);
      }
    })();
  });

  const start = async () => {
    setBusy(true);
    setMessage(null);
    let outcome: SignInOutcome;
    try {
      outcome = await signIn();
    } catch (cause) {
      setMessage({ kind: 'error', text: authErrorText(cause) });
      setBusy(false);
      return;
    }
    // Redirecting: the page is about to navigate away, keep the button busy.
    if (outcome.status === 'redirecting') return;
    if (outcome.status === 'ok') await enter(outcome.email);
    setBusy(false);
  };

  const sendLink = async () => {
    const trimmed = linkEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage({ kind: 'error', text: 'Escribe un correo válido para enviarte el enlace.' });
      return;
    }
    setLinkState('sending');
    setMessage(null);
    try {
      await sendLoginLink(trimmed);
      setLinkEmail(trimmed);
      setLinkState('sent');
    } catch (cause) {
      setLinkState('idle');
      setMessage({
        kind: 'error',
        text:
          cause instanceof AuthFlowError
            ? cause.message
            : 'No se pudo enviar el enlace. Inténtalo de nuevo en unos segundos.',
      });
    }
  };

  const confirmLinkEmail = async () => {
    const trimmed = linkEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage({ kind: 'error', text: 'Escribe el correo con el que pediste el enlace.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await completeEmailLink(trimmed);
      if (outcome.status === 'ok') await enter(outcome.email);
    } catch (cause) {
      setMessage({ kind: 'error', text: authErrorText(cause) });
    } finally {
      setBusy(false);
    }
  };

  const closeSession = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      // The local UI state is cleared regardless.
    }
    setEmail(null);
    setSubscribed(false);
    setScopes([]);
    setWeekly(true);
    setMonthly(false);
    setLinkEmail('');
    setLinkState('idle');
    setMessage(null);
    setBusy(false);
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

        {checking ? (
          <section className="newsletter-signin" aria-busy="true">
            <p>Comprobando tu sesión…</p>
          </section>
        ) : pendingLinkEmail ? (
          <section className="newsletter-signin">
            <p>
              Has abierto un enlace de acceso pedido desde otro dispositivo. Confirma el correo con
              el que lo pediste para completar la entrada.
            </p>
            <form
              className="newsletter-linkform"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmLinkEmail();
              }}
            >
              <input
                type="email"
                autoComplete="email"
                placeholder="tu@correo.es"
                value={linkEmail}
                onChange={(event) => setLinkEmail(event.target.value)}
                aria-label="Correo con el que pediste el enlace"
              />
              <button className="button button--primary" type="submit" disabled={busy}>
                {busy ? 'Comprobando…' : 'Confirmar correo'}
              </button>
            </form>
          </section>
        ) : email === null ? (
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
            <p className="newsletter-signin__divider" aria-hidden="true">
              o
            </p>
            {linkState === 'sent' ? (
              <p role="status">
                Te hemos enviado un enlace a <strong>{linkEmail}</strong>. Ábrelo en este
                dispositivo para entrar. Si no llega, revisa la carpeta de correo no deseado.
              </p>
            ) : (
              <form
                className="newsletter-linkform"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendLink();
                }}
              >
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.es"
                  value={linkEmail}
                  onChange={(event) => setLinkEmail(event.target.value)}
                  aria-label="Correo para recibir un enlace de acceso"
                  disabled={linkState === 'sending'}
                />
                <button
                  className="button button--ghost"
                  type="submit"
                  disabled={busy || linkState === 'sending'}
                >
                  <Mail size={18} />{' '}
                  {linkState === 'sending' ? 'Enviando…' : 'Enviarme un enlace de acceso'}
                </button>
              </form>
            )}
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
              <p
                role={message.kind === 'error' ? 'alert' : 'status'}
                className={`newsletter-message newsletter-message--${message.kind}`}
              >
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
              <button
                className="button button--ghost"
                type="button"
                disabled={busy}
                onClick={() => void closeSession()}
              >
                <LogOut size={18} /> Cerrar sesión
              </button>
            </div>
          </section>
        )}

        {email === null && message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`newsletter-message newsletter-message--${message.kind}`}
          >
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
