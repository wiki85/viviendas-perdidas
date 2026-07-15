import { lazy, Suspense } from 'react';
import type { LatLng, Listing, MapBounds, NeighborhoodFeature } from '../../domain/types';
import { appConfig } from '../../lib/config';
import { DemoMap } from './DemoMap';

const RealMap = lazy(() => import('./RealMap'));

export type MapStageProps = {
  center: LatLng;
  zoom: number;
  bounds: MapBounds;
  listings: Listing[];
  selectedId: string | null;
  // Only for the demo map's watermark label; polygons are no longer drawn
  // (the bundled boundaries are placeholder rectangles, not real limits).
  activeNeighborhood: NeighborhoodFeature | null;
  placementMode: boolean;
  placementPosition: LatLng | null;
  onViewportChange: (center: LatLng, zoom: number, bounds: MapBounds) => void;
  onSelectListing: (listing: Listing) => void;
  onPickLocation: (position: LatLng) => void;
};

export function MapStage(props: MapStageProps) {
  if (!appConfig.googleMapsApiKey) return <DemoMap {...props} />;
  return (
    <Suspense
      fallback={
        <div className="map-loading" role="status">
          <span />
          Cargando el mapa…
        </div>
      }
    >
      <RealMap {...props} apiKey={appConfig.googleMapsApiKey} mapId={appConfig.googleMapsMapId} />
    </Suspense>
  );
}
