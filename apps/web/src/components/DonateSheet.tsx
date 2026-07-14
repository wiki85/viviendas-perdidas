import { useEffect, useRef, useState } from 'react';
import { Check, Coffee, Copy, CreditCard, ExternalLink, Smartphone, X } from 'lucide-react';
import { appConfig } from '../lib/config';

type Props = {
  onClose: () => void;
};

// Precio medio de un café en España, la unidad de donación por defecto.
const COFFEE_PRICE_EUR = 1.8;
const AMOUNTS = [
  { value: COFFEE_PRICE_EUR, label: 'Un café' },
  { value: 5, label: '5 €' },
  { value: 10, label: '10 €' },
] as const;

function formatEuros(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatPhone(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
}

export function DonateSheet({ onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [amount, setAmount] = useState<number>(COFFEE_PRICE_EUR);
  const [copied, setCopied] = useState(false);
  const { bizumPhone, cardUrl } = appConfig.donation;

  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copyPhone = async () => {
    if (!bizumPhone) return;
    try {
      await navigator.clipboard.writeText(bizumPhone);
      setCopied(true);
    } catch {
      setCopied(false);
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
        className="bottom-sheet donate-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-title"
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button
          ref={closeButton}
          className="sheet-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar donaciones"
        >
          <X size={20} />
        </button>
        <div className="donate-sheet__body">
          <span className="donate-sheet__icon" aria-hidden="true">
            <Coffee size={26} />
          </span>
          <h2 id="donate-title">Invítame a un café</h2>
          <p>
            Este proyecto es personal, independiente y sin ánimo de lucro, pero mantenerlo en marcha
            tiene costes reales: las APIs de Google Maps (mapa, buscador, Street View) y la
            infraestructura de base de datos y servidores.{' '}
            <strong>
              Todo lo recaudado se destina íntegramente a pagar esos costes de mantenimiento.
            </strong>
          </p>
          <div className="donate-amounts" role="radiogroup" aria-label="Importe de la donación">
            {AMOUNTS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={amount === option.value}
                className={amount === option.value ? 'is-selected' : ''}
                onClick={() => setAmount(option.value)}
              >
                <strong>{formatEuros(option.value)}</strong>
                <small>{option.label}</small>
              </button>
            ))}
          </div>
          {bizumPhone && (
            <div className="donate-method">
              <h3>
                <Smartphone size={17} /> Por Bizum
              </h3>
              <p>
                Abre la app de tu banco, entra en <strong>Bizum → Enviar dinero</strong> y envía{' '}
                <strong>{formatEuros(amount)}</strong> a este número:
              </p>
              <div className="donate-phone">
                <span>{formatPhone(bizumPhone)}</span>
                <button className="button button--secondary" type="button" onClick={copyPhone}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar número'}
                </button>
              </div>
            </div>
          )}
          {cardUrl && (
            <div className="donate-method">
              <h3>
                <CreditCard size={17} /> Con tarjeta o Apple Pay
              </h3>
              <p>El pago se procesa de forma segura en una página externa.</p>
              <a className="button button--primary" href={cardUrl} target="_blank" rel="noreferrer">
                Donar {formatEuros(amount)} con tarjeta <ExternalLink size={16} />
              </a>
            </div>
          )}
          <p className="donate-footnote">
            Las donaciones son voluntarias y no dan acceso a funciones adicionales: la aplicación es
            igual para todo el mundo.
          </p>
        </div>
      </section>
    </div>
  );
}
