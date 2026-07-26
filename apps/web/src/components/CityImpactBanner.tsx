import { useCallback, useEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { formatEurosCompact, type CityImpactSummary } from '../lib/city-impact';
import { formatInteger } from '../lib/impact';

type Props = {
  cityId: string;
  cityName: string;
  summary: CityImpactSummary;
  onClose: () => void;
};

const AUTO_HIDE_MS = 6_000;
const LEAVE_ANIMATION_MS = 300;

/**
 * Ephemeral banner shown once per city and session when the map enters a
 * city with data: a one-line digest of its impact report. Auto-hides after a
 * few seconds; hovering or focusing it keeps it on screen.
 */
export function CityImpactBanner({ cityId, cityName, summary, onClose }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const leave = useCallback(() => {
    container.current?.classList.add('impact-banner--leaving');
    leaveTimer.current = window.setTimeout(() => onCloseRef.current(), LEAVE_ANIMATION_MS);
  }, []);

  const pause = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    pause();
    hideTimer.current = window.setTimeout(leave, AUTO_HIDE_MS);
  }, [leave, pause]);

  useEffect(() => {
    resume();
    return () => {
      pause();
      // An orphaned leave timeout would close the NEXT banner instance
      // (onCloseRef points at the shared close handler in App).
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    };
  }, [pause, resume]);

  const facts: string[] = [
    `${formatEurosCompact(summary.annualSpendEur)}/año que pierde el comercio de barrio`,
  ];
  if (summary.classrooms > 0) {
    facts.push(
      `${formatInteger(summary.classrooms)} ${summary.classrooms === 1 ? 'aula vacía' : 'aulas vacías'}`,
    );
  }
  if (summary.officialStockSharePct !== null) {
    facts.push(
      `${summary.officialStockSharePct.toLocaleString('es-ES')}% de los hogares de la ciudad`,
    );
  }

  return (
    <div
      ref={container}
      className="impact-banner"
      role="status"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <p className="impact-banner__body">
        <strong>{cityName}</strong> dedica {formatInteger(summary.dwellingsTotal)} viviendas al
        turismo
        <span className="impact-banner__facts">{facts.join(' · ')}</span>
      </p>
      <a
        className="impact-banner__link"
        href={`/ciudad/${encodeURIComponent(cityId)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver informe <ArrowRight size={14} aria-hidden="true" />
      </a>
      <button
        className="impact-banner__close"
        type="button"
        onClick={leave}
        aria-label="Cerrar aviso"
      >
        <X size={16} />
      </button>
    </div>
  );
}
