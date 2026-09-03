import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/use-media-query';

/**
 * Disposición de la hoja en escritorio (en móvil todas son hojas inferiores):
 * - `sheet`: hoja/diálogo centrado con sombreado.
 * - `panel`: panel lateral derecho sin sombreado; el mapa sigue interactivo.
 * - `menu`: tarjeta que emerge sobre el dock de navegación.
 */
export type SheetVariant = 'sheet' | 'panel' | 'menu';

type Props = {
  variant?: SheetVariant;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
};

export function Sheet({
  variant = 'sheet',
  labelledBy,
  onClose,
  children,
  className = '',
  closeLabel = 'Cerrar',
}: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const modal = !(desktop && variant === 'panel');

  // Foco al botón de cierre al abrir y de vuelta al disparador al cerrar;
  // Escape cierra. Las dependencias vacías evitan robar el foco en cada render.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className={`sheet-layer sheet-layer--${variant}`}
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onCloseRef.current();
      }}
    >
      <section
        className={`sheet sheet--${variant} ${className}`.trim()}
        role="dialog"
        aria-modal={modal}
        aria-labelledby={labelledBy}
      >
        <span className="sheet__handle" aria-hidden="true" />
        <button
          ref={closeButton}
          className="sheet__close"
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
