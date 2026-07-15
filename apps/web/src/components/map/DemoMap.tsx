import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, LocateFixed, Minus, Plus } from 'lucide-react';
import type { LatLng } from '../../domain/types';
import { approximateBounds } from '../../lib/geo';
import type { MapStageProps } from './MapStage';

const TILE_SIZE = 256;

function worldPixel(position: LatLng, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sine = Math.min(0.9999, Math.max(-0.9999, Math.sin((position.lat * Math.PI) / 180)));
  return {
    x: ((position.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}

function fromWorldPixel(pixel: { x: number; y: number }, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (pixel.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * pixel.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export function DemoMap({
  center,
  zoom,
  listings,
  selectedId,
  activeNeighborhood,
  placementMode,
  placementPosition,
  onViewportChange,
  onSelectListing,
  onPickLocation,
}: MapStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    centerPixel: { x: number; y: number };
  } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const projectedListings = useMemo(() => {
    const centerPixel = worldPixel(center, zoom);
    return listings.map((listing) => {
      const pixel = worldPixel(listing.location, zoom);
      return {
        listing,
        left: size.width / 2 + pixel.x - centerPixel.x,
        top: size.height / 2 + pixel.y - centerPixel.y,
      };
    });
  }, [center, listings, size.height, size.width, zoom]);

  const demoClusters = useMemo(() => {
    if (zoom >= 11) return [];
    const groups = new Map<string, typeof listings>();
    for (const listing of listings) {
      const current = groups.get(listing.cityId) ?? [];
      current.push(listing);
      groups.set(listing.cityId, current);
    }
    const centerPixel = worldPixel(center, zoom);
    return Array.from(groups.entries()).map(([cityId, entries]) => {
      const position = {
        lat: entries.reduce((sum, entry) => sum + entry.location.lat, 0) / entries.length,
        lng: entries.reduce((sum, entry) => sum + entry.location.lng, 0) / entries.length,
      };
      const pixel = worldPixel(position, zoom);
      return {
        cityId,
        entries,
        position,
        left: size.width / 2 + pixel.x - centerPixel.x,
        top: size.height / 2 + pixel.y - centerPixel.y,
      };
    });
  }, [center, listings, size.height, size.width, zoom]);

  const updateZoom = (nextZoom: number) => {
    const boundedZoom = Math.max(5, Math.min(19, nextZoom));
    onViewportChange(center, boundedZoom, approximateBounds(center, boundedZoom));
  };

  const chooseAtPointer = (clientX: number, clientY: number) => {
    if (!root.current) return;
    const rect = root.current.getBoundingClientRect();
    const centerPixel = worldPixel(center, zoom);
    const pixel = {
      x: centerPixel.x + clientX - rect.left - rect.width / 2,
      y: centerPixel.y + clientY - rect.top - rect.height / 2,
    };
    onPickLocation(fromWorldPixel(pixel, zoom));
  };

  return (
    <div
      ref={root}
      className={`demo-map ${placementMode ? 'demo-map--placing' : ''}`}
      role="application"
      tabIndex={0}
      aria-label="Mapa demostrativo interactivo. Arrastra para desplazarte y usa los controles para acercar o alejar."
      onKeyDown={(event) => {
        const movement = 80;
        const centerPixel = worldPixel(center, zoom);
        const offsets: Partial<Record<string, { x: number; y: number }>> = {
          ArrowUp: { x: 0, y: -movement },
          ArrowDown: { x: 0, y: movement },
          ArrowLeft: { x: -movement, y: 0 },
          ArrowRight: { x: movement, y: 0 },
        };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        const nextCenter = fromWorldPixel(
          { x: centerPixel.x + offset.x, y: centerPixel.y + offset.y },
          zoom,
        );
        onViewportChange(nextCenter, zoom, approximateBounds(nextCenter, zoom));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (placementMode) {
          chooseAtPointer(event.clientX, event.clientY);
          return;
        }
        root.current?.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          centerPixel: worldPixel(center, zoom),
        };
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const nextPixel = {
          x: drag.current.centerPixel.x - (event.clientX - drag.current.x),
          y: drag.current.centerPixel.y - (event.clientY - drag.current.y),
        };
        const nextCenter = fromWorldPixel(nextPixel, zoom);
        onViewportChange(nextCenter, zoom, approximateBounds(nextCenter, zoom));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onWheel={(event) => {
        event.preventDefault();
        updateZoom(zoom + (event.deltaY < 0 ? 1 : -1));
      }}
    >
      <svg className="demo-map__canvas" width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern
            id="smallGrid"
            width="42"
            height="42"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${center.lng * 8})`}
          >
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#ded7c9" strokeWidth="1" />
          </pattern>
          <pattern id="blocks" width="168" height="126" patternUnits="userSpaceOnUse">
            <rect x="12" y="14" width="58" height="34" rx="5" fill="#e5ddcf" />
            <rect x="84" y="12" width="66" height="54" rx="6" fill="#e2d8ca" />
            <rect x="18" y="66" width="90" height="44" rx="6" fill="#e8dfd2" />
            <rect x="118" y="78" width="34" height="34" rx="4" fill="#ded4c6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#f4f0e8" />
        <rect width="100%" height="100%" fill="url(#blocks)" opacity={zoom >= 11 ? 1 : 0.35} />
        <rect
          width="100%"
          height="100%"
          fill="url(#smallGrid)"
          opacity={zoom >= 10 ? 0.72 : 0.25}
        />
        <path
          d={`M -30 ${size.height * 0.7} Q ${size.width * 0.28} ${size.height * 0.38}, ${size.width + 30} ${size.height * 0.48}`}
          fill="none"
          stroke="#fff"
          strokeWidth="18"
          opacity=".92"
        />
        <path
          d={`M ${size.width * 0.66} -30 Q ${size.width * 0.47} ${size.height * 0.5}, ${size.width * 0.72} ${size.height + 30}`}
          fill="none"
          stroke="#fff"
          strokeWidth="12"
          opacity=".9"
        />
      </svg>
      <div className="demo-map__watermark" aria-hidden="true">
        <span>vista de demostración</span>
        <strong>
          {zoom < 10 ? 'España' : (activeNeighborhood?.properties.name ?? 'Mapa urbano')}
        </strong>
      </div>
      {demoClusters.map(({ cityId, entries, position, left, top }) => (
        <button
          className="demo-cluster"
          type="button"
          key={cityId}
          style={{ left, top }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onViewportChange(position, 12, approximateBounds(position, 12))}
          aria-label={`${entries.length} registros en ${entries[0]?.address.locality}. Acercar.`}
        >
          <strong>{entries.length}</strong>
          <span>{entries.reduce((sum, entry) => sum + entry.dwellingsCount, 0)} viv.</span>
        </button>
      ))}
      {projectedListings.map(({ listing, left, top }) =>
        zoom >= 11 &&
        left > -60 &&
        left < size.width + 60 &&
        top > -60 &&
        top < size.height + 60 ? (
          <button
            type="button"
            key={listing.id}
            style={{ left, top }}
            className={`map-marker map-marker--${listing.type} ${listing.status === 'flagged' ? 'map-marker--flagged' : ''} ${selectedId === listing.id ? 'map-marker--selected' : ''}`}
            aria-label={
              listing.type === 'commercial'
                ? `Local comercial convertido, ${listing.address.formatted}`
                : `${listing.type === 'building' ? 'Edificio completo o parcial' : 'Apartamento'}, ${listing.dwellingsCount} ${listing.dwellingsCount === 1 ? 'vivienda' : 'viviendas'}, ${listing.address.formatted}`
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelectListing(listing)}
          >
            <span aria-hidden="true">
              {listing.type === 'building' ? '🏢' : listing.type === 'commercial' ? '🏪' : '⌂'}
            </span>
            {listing.type === 'building' && <b>{listing.dwellingsCount}</b>}
          </button>
        ) : null,
      )}
      {placementPosition && (
        <span
          className="placement-pin"
          style={(() => {
            const pin = worldPixel(placementPosition, zoom);
            const mapCenter = worldPixel(center, zoom);
            return {
              left: size.width / 2 + pin.x - mapCenter.x,
              top: size.height / 2 + pin.y - mapCenter.y,
            };
          })()}
          aria-label="Ubicación seleccionada"
        >
          <MapPinIcon />
        </span>
      )}
      {placementMode && (
        <div className="placement-hint" aria-live="polite">
          <Crosshair size={16} /> Toca el edificio en el mapa
        </div>
      )}
      <div className="map-controls">
        <button type="button" onClick={() => updateZoom(zoom + 1)} aria-label="Acercar mapa">
          <Plus />
        </button>
        <button type="button" onClick={() => updateZoom(zoom - 1)} aria-label="Alejar mapa">
          <Minus />
        </button>
        {placementMode && (
          <button
            type="button"
            onClick={() => onPickLocation(center)}
            aria-label="Usar el centro del mapa"
          >
            <LocateFixed />
          </button>
        )}
      </div>
    </div>
  );
}

function MapPinIcon() {
  return <span aria-hidden="true">●</span>;
}
