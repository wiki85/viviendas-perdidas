import { FileText, MailPlus, Share2 } from 'lucide-react';
import type { Aggregate, OfficialViewportStats, SourceMode } from '../../domain/types';
import { HOUSEHOLD_SIZE } from '../../lib/constants';
import { formatInteger } from '../../lib/impact';
import { Metrics } from './Metrics';

export type CityReportLink = { id: string; name: string };

export type ImpactDetailsProps = {
  aggregate: Aggregate;
  viewportMode: boolean;
  loading: boolean;
  sourceMode: SourceMode;
  onSourceModeChange: (mode: SourceMode) => void;
  /** Cifras del registro oficial en la zona visible (null mientras cargan). */
  official: OfficialViewportStats | null;
  officialStatus: 'ready' | 'loading' | 'error';
  sourceToggleAvailable: boolean;
  cityReport: CityReportLink | null;
  onOpenNewsletter: (cityId?: string) => void;
  onShare: () => void;
  onOpenMethodology: () => void;
  /** Cifras grandes (hoja móvil) frente a compactas (panel de escritorio). */
  large?: boolean;
  /** La hoja móvil ya lleva el nombre del ámbito como título. */
  hideScopeName?: boolean;
};

const SOURCE_LABELS: Record<SourceMode, string> = {
  citizens: 'Vecinal',
  official: 'Oficial',
  both: 'Ambas',
};

function scopeQualifier(aggregate: Aggregate, viewportMode: boolean): string {
  if (viewportMode) return 'Suma de lo visible en el mapa';
  if (aggregate.scope === 'neighborhood') return 'Datos del barrio';
  if (aggregate.scope === 'city') return 'Datos del municipio';
  return 'Explora una ciudad';
}

export function ScopeLine({
  aggregate,
  viewportMode,
  loading,
  hideName = false,
}: Pick<ImpactDetailsProps, 'aggregate' | 'viewportMode' | 'loading'> & { hideName?: boolean }) {
  return (
    <p className="scope-line" aria-live="polite" aria-atomic="true">
      {!hideName && <strong>{aggregate.name}</strong>}
      <span>{scopeQualifier(aggregate, viewportMode)}</span>
      {loading && <span className="scope-line__pulse" aria-label="Actualizando" />}
    </p>
  );
}

export function SourceToggle({
  sourceMode,
  onSourceModeChange,
}: Pick<ImpactDetailsProps, 'sourceMode' | 'onSourceModeChange'>) {
  return (
    <div className="source-toggle" role="radiogroup" aria-label="Fuente de datos">
      {(['citizens', 'official', 'both'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={sourceMode === mode}
          onClick={() => onSourceModeChange(mode)}
        >
          {SOURCE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}

export function RecordsLine({
  aggregate,
  sourceMode,
  official,
  officialStatus,
}: Pick<ImpactDetailsProps, 'aggregate' | 'sourceMode' | 'official' | 'officialStatus'>) {
  if (sourceMode === 'official') {
    if (officialStatus === 'loading')
      return <p className="records-line">Cargando el registro oficial…</p>;
    if (officialStatus === 'error') {
      return <p className="records-line">No se ha podido cargar el registro oficial.</p>;
    }
    return (
      <p className="records-line">
        <strong>{formatInteger(aggregate.listingsCount)}</strong> viviendas del registro oficial a
        la vista
      </p>
    );
  }
  return (
    <p className="records-line">
      <strong>{formatInteger(aggregate.listingsCount)}</strong>{' '}
      {aggregate.listingsCount === 1 ? 'registro vecinal' : 'registros vecinales'}
      {sourceMode === 'both' && officialStatus === 'ready'
        ? ` + ${formatInteger(official?.total ?? 0)} del registro oficial`
        : ''}
    </p>
  );
}

/** Bloque completo de cifras: compartido por el panel lateral y la hoja móvil. */
export function ImpactDetails(props: ImpactDetailsProps) {
  const { aggregate, cityReport, sourceToggleAvailable, large = false } = props;
  return (
    <div className="impact">
      <ScopeLine
        aggregate={aggregate}
        viewportMode={props.viewportMode}
        loading={props.loading}
        hideName={props.hideScopeName}
      />
      {sourceToggleAvailable && (
        <SourceToggle sourceMode={props.sourceMode} onSourceModeChange={props.onSourceModeChange} />
      )}
      <Metrics aggregate={aggregate} large={large} />
      <RecordsLine
        aggregate={aggregate}
        sourceMode={props.sourceMode}
        official={props.official}
        officialStatus={props.officialStatus}
      />
      <div className="impact__actions">
        {cityReport && (
          <a
            className="chip chip--report"
            href={`/ciudad/${encodeURIComponent(cityReport.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText size={16} aria-hidden="true" /> Informe de {cityReport.name}
          </a>
        )}
        <button
          className="chip"
          type="button"
          onClick={() => props.onOpenNewsletter(cityReport?.id)}
        >
          <MailPlus size={16} aria-hidden="true" />{' '}
          {cityReport ? `Suscríbete a ${cityReport.name}` : 'Suscríbete al boletín'}
        </button>
        <button className="chip" type="button" onClick={props.onShare}>
          <Share2 size={16} aria-hidden="true" /> Compartir
        </button>
      </div>
      <p className="impact__credit">
        Estimación con {HOUSEHOLD_SIZE.toLocaleString('es-ES')} personas por hogar (INE).{' '}
        <button className="text-link" type="button" onClick={props.onOpenMethodology}>
          Cómo se calcula
        </button>
      </p>
    </div>
  );
}
