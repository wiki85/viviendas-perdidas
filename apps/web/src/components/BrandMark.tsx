import { Building2 } from 'lucide-react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="Viviendas Perdidas">
      <span className="brand-mark__icon" aria-hidden="true">
        <Building2 size={18} strokeWidth={2.4} />
        <span />
      </span>
      {!compact && (
        <span className="brand-mark__text">
          Viviendas <strong>Perdidas</strong>
        </span>
      )}
    </div>
  );
}
