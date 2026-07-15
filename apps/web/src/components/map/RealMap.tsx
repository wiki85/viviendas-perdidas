import { useEffect, useMemo } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import type { Listing } from '../../domain/types';
import { MAP_STYLE } from '../../lib/constants';
import type { MapStageProps } from './MapStage';

type RealMapProps = MapStageProps & { apiKey: string; mapId: string };

function MarkerLayer({
  listings,
  selectedId,
  onSelect,
}: {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (listing: Listing) => void;
}) {
  const map = useMap();
  const markerData = useMemo(
    () => ({ listings, selectedId, onSelect }),
    [listings, onSelect, selectedId],
  );

  useEffect(() => {
    if (!map || !google.maps.marker?.AdvancedMarkerElement) return;
    const markers = markerData.listings.map((listing) => {
      const content = document.createElement('button');
      content.type = 'button';
      content.className = `map-marker map-marker--${listing.type} ${listing.status === 'flagged' ? 'map-marker--flagged' : ''} ${markerData.selectedId === listing.id ? 'map-marker--selected' : ''}`;
      content.setAttribute(
        'aria-label',
        listing.type === 'commercial'
          ? `Local comercial convertido, ${listing.address.formatted}`
          : `${listing.type === 'building' ? 'Edificio completo o parcial' : 'Apartamento'}, ${listing.dwellingsCount} viviendas, ${listing.address.formatted}`,
      );
      content.innerHTML = `<span aria-hidden="true">${listing.type === 'building' ? '🏢' : listing.type === 'commercial' ? '🏪' : '⌂'}</span>${listing.type === 'building' ? `<b>${listing.dwellingsCount}</b>` : ''}`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: listing.location,
        content,
        title: listing.address.formatted,
      });
      marker.addListener('click', () => markerData.onSelect(listing));
      return marker;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    return () => {
      clusterer.clearMarkers();
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [map, markerData]);
  return null;
}

function MapContent(props: RealMapProps) {
  return (
    <>
      <Map
        center={props.center}
        zoom={props.zoom}
        mapId={props.mapId}
        className="real-map"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        styles={props.mapId === 'DEMO_MAP_ID' ? MAP_STYLE : undefined}
        onCameraChanged={(event) => {
          // Camera events fire during gestures; syncing state continuously keeps
          // this controlled map draggable/zoomable instead of snapping back.
          const { center, zoom, bounds } = event.detail;
          props.onViewportChange({ lat: center.lat, lng: center.lng }, zoom, bounds);
        }}
        onClick={(event: MapMouseEvent) => {
          if (props.placementMode && event.detail.latLng) props.onPickLocation(event.detail.latLng);
        }}
      >
        <MarkerLayer
          listings={props.listings}
          selectedId={props.selectedId}
          onSelect={props.onSelectListing}
        />
        {props.placementPosition && (
          <AdvancedMarker
            position={props.placementPosition}
            draggable
            onDragEnd={(event) => {
              const position = event.latLng;
              if (position) props.onPickLocation({ lat: position.lat(), lng: position.lng() });
            }}
            title="Ubicación seleccionada"
          >
            <span
              className="placement-pin placement-pin--google"
              aria-label="Ubicación seleccionada"
            >
              <span>●</span>
            </span>
          </AdvancedMarker>
        )}
      </Map>
      {props.placementMode && (
        <div className="placement-hint" aria-live="polite">
          Toca el edificio o arrastra el pin
        </div>
      )}
    </>
  );
}

export default function RealMap(props: RealMapProps) {
  return (
    <APIProvider
      apiKey={props.apiKey}
      libraries={['places', 'marker']}
      onLoad={() => window.dispatchEvent(new Event('viviendas-perdidas:maps-ready'))}
    >
      <MapContent {...props} />
    </APIProvider>
  );
}
