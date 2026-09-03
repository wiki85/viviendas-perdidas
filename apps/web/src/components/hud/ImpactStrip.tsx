import { ChevronUp, FileText } from 'lucide-react';
import type { Aggregate } from '../../domain/types';
import { Metrics } from './Metrics';
import type { CityReportLink } from './ImpactDetails';

type Props = {
  aggregate: Aggregate;
  viewportMode: boolean;
  loading: boolean;
  cityReport: CityReportLink | null;
  expanded: boolean;
  onOpen: () => void;
};

/**
 * Franja de móvil sobre el dock: ámbito y tres cifras. Tocarla abre la hoja
 * con el detalle (fuente, registros, informe, boletín).
 */
export function ImpactStrip({
  aggregate,
  viewportMode,
  loading,
  cityReport,
  expanded,
  onOpen,
}: Props) {
  return (
    <section
      className={cityReport ? 'impact-strip impact-strip--with-report' : 'impact-strip'}
      aria-label="Cifras de la zona visible"
    >
      <button
        className="impact-strip__main"
        type="button"
        onClick={onOpen}
        aria-expanded={expanded}
        aria-controls="impact-sheet"
      >
        <span className="impact-strip__head">
          <strong>{aggregate.name}</strong>
          {aggregate.scope !== 'country' && (
            <span>{viewportMode ? 'lo visible en el mapa' : 'datos del ámbito'}</span>
          )}
          {loading && <span className="scope-line__pulse" aria-label="Actualizando" />}
        </span>
        <Metrics aggregate={aggregate} />
      </button>
      <ChevronUp className="impact-strip__chevron" size={20} aria-hidden="true" />
      {cityReport && (
        <a
          className="impact-strip__report"
          href={`/ciudad/${encodeURIComponent(cityReport.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Informe de ${cityReport.name} (se abre en otra pestaña)`}
        >
          <FileText size={14} aria-hidden="true" /> Informe
        </a>
      )}
    </section>
  );
}
