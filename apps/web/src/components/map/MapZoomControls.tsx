import { Minus, Plus } from 'lucide-react';
import { useMap } from '@vis.gl/react-google-maps';

/**
 * Zoom accesible para ratón y teclado: el mapa de Google va sin interfaz
 * propia y en pantallas táctiles basta con pellizcar (se oculta por CSS).
 */
export function MapZoomControls() {
  const map = useMap();
  if (!map) return null;
  const zoomBy = (delta: number) => {
    const current = map.getZoom() ?? 10;
    map.setZoom(Math.max(5, Math.min(20, current + delta)));
  };
  return (
    <div className="map-zoom map-zoom--pointer-only" role="group" aria-label="Zoom del mapa">
      <button type="button" onClick={() => zoomBy(1)} aria-label="Acercar mapa">
        <Plus size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => zoomBy(-1)} aria-label="Alejar mapa">
        <Minus size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
