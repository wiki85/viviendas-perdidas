import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import type { ContactMessageInput } from '../domain/types';
import { BrandMark } from './BrandMark';

type Props = {
  onClose: () => void;
  onSubmit: (input: ContactMessageInput) => Promise<void>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const MIN_MESSAGE_LENGTH = 20;

/**
 * Contact form. Deliberately unreachable by crawlers: it has no URL of its
 * own (state-only view) and pins a robots noindex meta while mounted.
 */
export function ContactPage({ onClose, onSubmit }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const openedAt = useRef(Date.now());

  useEffect(() => {
    // Belt and braces: even embedded in the SPA, mark the view as
    // non-indexable while it is open.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noai';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const nameError = fullName.trim().length < 2 ? 'Escribe tu nombre y apellidos.' : null;
  const emailError = !EMAIL_PATTERN.test(email.trim())
    ? 'Escribe un correo electrónico válido.'
    : null;
  const messageError =
    message.trim().length < MIN_MESSAGE_LENGTH
      ? `El mensaje debe tener al menos ${MIN_MESSAGE_LENGTH} caracteres.`
      : null;
  const formValid = nameError === null && emailError === null && messageError === null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!formValid || status === 'sending') return;
    setStatus('sending');
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        website,
        elapsedMs: Date.now() - openedAt.current,
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="about-page">
      <nav className="about-page__nav">
        <button className="button button--ghost" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al mapa
        </button>
        <BrandMark />
      </nav>
      <article className="about-page__article">
        <p className="eyebrow">Contacto</p>
        <h1>Escríbenos</h1>
        <section className="about-page__section">
          <p>
            ¿Has visto un error, tienes una idea o representas a un medio o colectivo vecinal?
            Cuéntanoslo. Leemos todos los mensajes, aunque no siempre podamos responder al momento.
          </p>
          {status === 'sent' ? (
            <p className="contact-success" role="status">
              <Mail size={18} aria-hidden="true" /> ¡Gracias! Tu mensaje se ha enviado
              correctamente.
            </p>
          ) : (
            <form className="contact-form" onSubmit={(event) => void submit(event)} noValidate>
              <label className="field">
                Nombre y apellidos
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
                {touched && nameError && <small className="field-error">{nameError}</small>}
              </label>
              <label className="field">
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={200}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                {touched && emailError && <small className="field-error">{emailError}</small>}
              </label>
              <label className="field">
                Mensaje
                <textarea
                  name="message"
                  rows={6}
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
                {touched && messageError && <small className="field-error">{messageError}</small>}
              </label>
              {/* Honeypot: invisible para personas, irresistible para bots. */}
              <label className="contact-form__extra" aria-hidden="true">
                No rellenes este campo
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
              {status === 'error' && (
                <p className="field-error" role="alert">
                  No se ha podido enviar el mensaje. Inténtalo de nuevo en un momento.
                </p>
              )}
              <button
                className="button button--primary"
                type="submit"
                disabled={status === 'sending'}
              >
                <Send size={17} /> {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </form>
          )}
          <p className="contact-privacy">
            Solo usaremos tu correo para responderte. No se comparte con nadie ni se añade a ninguna
            lista.
          </p>
        </section>
      </article>
    </main>
  );
}
