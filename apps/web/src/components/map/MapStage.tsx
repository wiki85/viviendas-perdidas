import { lazy, Suspense } from 'react';
import type {
  LatLng,
  Listing,
  MapBounds,
  NeighborhoodCollection,
  NeighborhoodFeature,
} from '../../domain/types';
import { appConfig } from '../../lib/config';
import { DemoMap } from './DemoMap';

const RealMap = lazy(() => import('./RealMap'));

export type MapStageProps = {
  center: LatLng;
  zoom: number;
  bounds: MapBounds;
  listings: Listing[];
  selectedId: string | null;
  neighborhoods: NeighborhoodCollection | null;
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
