import type { Aggregate } from '../../domain/types';
import { useCountUp } from '../../hooks/use-count-up';
import { formatInteger } from '../../lib/impact';

function Metric({ value, label }: { value: number; label: string }) {
  const animated = useCountUp(value);
  return (
    <div className="metric">
      <span className="metric__number">{formatInteger(animated)}</span>
      <span className="metric__label">{label}</span>
    </div>
  );
}

/** Las tres cifras del ámbito: viviendas, habitantes y locales perdidos. */
export function Metrics({ aggregate, large = false }: { aggregate: Aggregate; large?: boolean }) {
  return (
    <div
      className={large ? 'metrics metrics--large' : 'metrics'}
      role="group"
      aria-label={`Impacto estimado en ${aggregate.name}`}
    >
      <Metric value={aggregate.lostDwellings} label="viviendas" />
      <Metric value={aggregate.lostInhabitants} label="habitantes" />
      <Metric value={aggregate.lostCommercial} label="locales" />
    </div>
  );
}
