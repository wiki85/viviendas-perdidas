/**
 * Marca: cuatro ventanas de las que una se ha apagado. Se dibuja en línea
 * para que escale y herede el color sin cargar ningún recurso.
 */
export function BrandIcon({ className = 'brand-mark__icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#c24b36" />
      <rect x="7.5" y="7.5" width="7" height="7" rx="1.5" fill="#fff" />
      <rect x="17.5" y="7.5" width="7" height="7" rx="1.5" fill="#fff" />
      <rect x="7.5" y="17.5" width="7" height="7" rx="1.5" fill="#fff" />
      <rect
        x="18.25"
        y="18.25"
        width="5.5"
        height="5.5"
        rx="1.25"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeDasharray="2 1.6"
        opacity="0.85"
      />
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-label="Viviendas Perdidas">
      <BrandIcon />
      {!compact && (
        <span className="brand-mark__text" aria-hidden="true">
          Viviendas <strong>Perdidas</strong>
        </span>
      )}
    </span>
  );
}
