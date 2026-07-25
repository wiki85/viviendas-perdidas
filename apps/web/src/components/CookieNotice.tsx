import { useState } from 'react';
import { Info, X } from 'lucide-react';

const NOTICE_KEY = 'viviendas-perdidas-map-notice-v2';

export function CookieNotice() {
  const [visible, setVisible] = useState(() => localStorage.getItem(NOTICE_KEY) !== 'seen');
  if (!visible) return null;
  return (
    <aside className="cookie-notice" aria-label="Información sobre Google Maps">
      <Info size={19} aria-hidden="true" />
      <p>
        Este sitio usa Google Maps, que puede establecer sus propias cookies, y mide las visitas de
        forma agregada y sin cookies (Cloudflare Web Analytics). No usamos cookies de seguimiento
        propias.{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Política de Google
        </a>
      </p>
      <button
        type="button"
        aria-label="Entendido, cerrar aviso"
        onClick={() => {
          localStorage.setItem(NOTICE_KEY, 'seen');
          setVisible(false);
        }}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
