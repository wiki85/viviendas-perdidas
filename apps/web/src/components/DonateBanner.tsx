import { useState } from 'react';
import { Coffee, X } from 'lucide-react';

const SNOOZE_KEY = 'vp-donate-banner-until';
const SNOOZE_DAYS = 14;
/** El aviso de cookies manda la primera visita; el banner espera a que se cierre. */
const COOKIE_NOTICE_KEY = 'viviendas-perdidas-map-notice-v2';

function snoozedUntil(): number {
  try {
    return Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function cookieNoticeDismissed(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) === 'seen';
  } catch {
    return true;
  }
}

type Props = {
  onOpen: () => void;
};

/**
 * Donation nudge pinned to the bottom of the map. Only the X dismisses it,
 * and doing so snoozes it for two weeks so it never becomes nagging.
 */
export function DonateBanner({ onOpen }: Props) {
  const [visible, setVisible] = useState(
    () => cookieNoticeDismissed() && Date.now() > snoozedUntil(),
  );
  if (!visible) return null;
  return (
    <aside className="donate-banner" aria-label="Apoya el proyecto">
      <span className="donate-banner__icon" aria-hidden="true">
        <Coffee size={19} />
      </span>
      <p>
        Este mapa es un proyecto vecinal sin ánimo de lucro, pero los mapas y servidores cuestan
        dinero. Si te resulta útil, <strong>invítanos a un café</strong>.
      </p>
      <button className="donate-banner__cta" type="button" onClick={onOpen}>
        <Coffee size={15} aria-hidden="true" /> Invitar
      </button>
      <button
        className="donate-banner__close"
        type="button"
        aria-label="Cerrar (no volverá a aparecer en dos semanas)"
        onClick={() => {
          try {
            window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
          } catch {
            // Sin almacenamiento (modo privado): solo se oculta esta visita.
          }
          setVisible(false);
        }}
      >
        <X size={17} />
      </button>
    </aside>
  );
}
