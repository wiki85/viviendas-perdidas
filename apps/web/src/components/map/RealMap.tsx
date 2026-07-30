import { useEffect, useRef } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  useMap,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import type { Listing, OfficialCell, OfficialPin } from '../../domain/types';
import { MAP_STYLE, SPAIN_BOUNDS } from '../../lib/constants';
import { formatCellCount } from '../../lib/official-cells';
import type { CameraCommand, MapStageProps } from './MapStage';

type RealMapProps = MapStageProps & { apiKey: string; mapId: string };

/** Applies programmatic camera moves (search, GPS, shared links). */
function CameraCommander({ command }: { command: CameraCommand | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !command) return;
    map.moveCamera({ center: command.center, zoom: command.zoom });
  }, [map, command]);
  return null;
}

/** Zoom applied when tapping a bubble: jumps into the next, finer band. */
const CELL_ZOOM_AFTER_CLICK: Record<number, number> = { 4: 10, 5: 13, 6: 15.4, 7: 17.2 };

function officialBubbleElement(count: number, label: string): HTMLButtonElement {
  const content = document.createElement('button');
  content.type = 'button';
  const size = count >= 1000 ? 'l' : count >= 100 ? 'm' : 's';
  content.className = `map-cluster--official map-cluster--official--${size}`;
  content.textContent = formatCellCount(count);
  content.setAttribute('aria-label', label);
  return content;
}

/** Aggregated bubbles of the official registry (server-precomputed cells). */
function OfficialCellsLayer({ cells }: { cells: OfficialCell[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || cells.length === 0 || !google.maps.marker?.AdvancedMarkerElement) return;
    const markers = cells.map((cell) => {
      const content = officialBubbleElement(
        cell.count,
        `${cell.count} viviendas turísticas del registro oficial en esta zona. Acercar.`,
      );
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: cell.location,
        content,
        zIndex: 1,
      });
      marker.addListener('click', () => {
        map.panTo(cell.location);
        map.setZoom(CELL_ZOOM_AFTER_CLICK[cell.precision] ?? 15);
      });
      return marker;
    });
    return () => {
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [map, cells]);
  return null;
}

/**
 * Exact official pins at street zoom, clustered like the community ones.
 * The clusterer lives once per map and pins are diffed by id: panning only
 * creates/removes the markers entering or leaving the view. A full rebuild
 * of ~1000 DOM markers per pan froze the map for seconds.
 */
function OfficialPinsLayer({
  pins,
  onSelect,
}: {
  pins: OfficialPin[];
  onSelect: (pin: OfficialPin) => void;
}) {
  const map = useMap();
  // Ref indirection: a new onSelect identity must not tear down the layer.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());

  useEffect(() => {
    if (!map || !google.maps.marker?.AdvancedMarkerElement) return;
    const clusterer = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render: ({ count, position }) =>
          new google.maps.marker.AdvancedMarkerElement({
            position,
            zIndex: 1,
            content: officialBubbleElement(
              count,
              `Grupo de ${count} viviendas turísticas oficiales. Acercar.`,
            ),
          }),
      },
    });
    clustererRef.current = clusterer;
    const markerStore = markersRef.current;
    return () => {
      clustererRef.current = null;
      markerStore.clear();
      // setMap(null) runs onRemove: detaches the clusterer's map 'idle'
      // listener and unmaps every marker — clearMarkers() alone leaks both.
      clusterer.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!clusterer || !map || !google.maps.marker?.AdvancedMarkerElement) return;
    const current = markersRef.current;
    const nextIds = new Set(pins.map((pin) => pin.id));
    const removed: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const [id, marker] of current) {
      if (!nextIds.has(id)) {
        removed.push(marker);
        current.delete(id);
      }
    }
    const added: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const pin of pins) {
      if (current.has(pin.id)) continue;
      const content = document.createElement('button');
      content.type = 'button';
      content.className = 'map-marker--official';
      content.title = `${pin.registrationCode} · Registro oficial de turismo`;
      content.setAttribute('aria-label', `Vivienda turística oficial ${pin.registrationCode}`);
      // No `map` here: the clusterer decides what gets attached, so we skip
      // mounting hundreds of elements that would be unmapped right after.
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: pin.location,
        content,
        zIndex: 1,
      });
      marker.addListener('click', () => onSelectRef.current(pin));
      current.set(pin.id, marker);
      added.push(marker);
    }
    if (removed.length > 0) clusterer.removeMarkers(removed, true);
    if (added.length > 0) clusterer.addMarkers(added, true);
    if (removed.length > 0 || added.length > 0) clusterer.render();
  }, [map, pins]);
  return null;
}

/** What forces rebuilding a community marker's DOM (type/status/counts). */
function listingSignature(listing: Listing): string {
  return `${listing.type}:${listing.status}:${listing.dwellingsCount}:${listing.commercialUnitsCount ?? 0}`;
}

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
  // Ref indirection: a new onSelect identity must not tear down the layer.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef(
    new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; signature: string }>(),
  );

  useEffect(() => {
    if (!map || !google.maps.marker?.AdvancedMarkerElement) return;
    const clusterer = new MarkerClusterer({ map, markers: [] });
    clustererRef.current = clusterer;
    const markerStore = markersRef.current;
    return () => {
      clustererRef.current = null;
      markerStore.clear();
      // setMap(null) runs onRemove: detaches the clusterer's map 'idle'
      // listener and unmaps every marker — clearMarkers() alone leaks both.
      clusterer.setMap(null);
    };
  }, [map]);

  // Diff by id: each settled pan replaces the array with mostly the same
  // listings, and rebuilding every marker (plus the clusterer index) is what
  // used to stutter the map. Selection is a class toggle, not a rebuild.
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!clusterer || !map || !google.maps.marker?.AdvancedMarkerElement) return;
    const current = markersRef.current;
    const next = new Map(listings.map((listing) => [listing.id, listing]));
    const removed: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const [id, entry] of current) {
      const listing = next.get(id);
      if (listing && listingSignature(listing) === entry.signature) continue;
      removed.push(entry.marker);
      current.delete(id);
    }
    const added: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const listing of listings) {
      if (current.has(listing.id)) continue;
      const content = document.createElement('button');
      content.type = 'button';
      content.className = `map-marker map-marker--${listing.type} ${listing.status === 'flagged' ? 'map-marker--flagged' : ''}`;
      content.setAttribute(
        'aria-label',
        listing.type === 'commercial'
          ? `Local comercial convertido, ${listing.address.formatted}`
          : `${listing.type === 'building' ? 'Edificio completo o parcial' : 'Apartamento'}, ${listing.dwellingsCount} viviendas, ${listing.address.formatted}`,
      );
      content.innerHTML = `<span aria-hidden="true">${listing.type === 'building' ? '🏢' : listing.type === 'commercial' ? '🏪' : '⌂'}</span>${listing.type === 'building' ? `<b>${listing.dwellingsCount}</b>` : ''}`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: listing.location,
        content,
        title: listing.address.formatted,
      });
      marker.addListener('click', () => onSelectRef.current(listing));
      current.set(listing.id, { marker, signature: listingSignature(listing) });
      added.push(marker);
    }
    if (removed.length > 0) clusterer.removeMarkers(removed, true);
    if (added.length > 0) clusterer.addMarkers(added, true);
    if (removed.length > 0 || added.length > 0) clusterer.render();
  }, [map, listings]);

  useEffect(() => {
    for (const [id, entry] of markersRef.current) {
      (entry.marker.content as HTMLElement | null)?.classList.toggle(
        'map-marker--selected',
        id === selectedId,
      );
    }
  }, [selectedId, listings]);
  return null;
}

function MapContent(props: RealMapProps) {
  // Camera events fire on every frame of a gesture. The map is uncontrolled
  // (defaultCenter/defaultZoom), so React state only needs the settled view:
  // a trailing ~120ms throttle turns 60 renders/s of the whole app into ~8.
  const latestCamera = useRef<{
    center: { lat: number; lng: number };
    zoom: number;
    bounds: MapStageProps['bounds'];
  } | null>(null);
  const cameraTimer = useRef<number | null>(null);
  const onViewportChangeRef = useRef(props.onViewportChange);
  onViewportChangeRef.current = props.onViewportChange;
  useEffect(() => {
    return () => {
      if (cameraTimer.current !== null) window.clearTimeout(cameraTimer.current);
    };
  }, []);
  return (
    <>
      <GoogleMap
        defaultCenter={props.center}
        defaultZoom={props.zoom}
        mapId={props.mapId}
        className="real-map"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        restriction={{ latLngBounds: SPAIN_BOUNDS, strictBounds: false }}
        styles={props.mapId === 'DEMO_MAP_ID' ? MAP_STYLE : undefined}
        onCameraChanged={(event) => {
          const { center, zoom, bounds } = event.detail;
          latestCamera.current = { center: { lat: center.lat, lng: center.lng }, zoom, bounds };
          if (cameraTimer.current !== null) return;
          cameraTimer.current = window.setTimeout(() => {
            cameraTimer.current = null;
            const settled = latestCamera.current;
            if (settled) onViewportChangeRef.current(settled.center, settled.zoom, settled.bounds);
          }, 120);
        }}
        onClick={(event: MapMouseEvent) => {
          if (props.placementMode && event.detail.latLng) props.onPickLocation(event.detail.latLng);
        }}
      >
        <CameraCommander command={props.cameraCommand} />
        <OfficialCellsLayer cells={props.officialCells} />
        <OfficialPinsLayer pins={props.officialPins} onSelect={props.onSelectOfficial} />
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
      </GoogleMap>
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
      // 'geocoding' explícito: el canal weekly de Maps dejó de exponer
      // google.maps.Geocoder sin importLibrary (jul 2026) y rompió en
      // silencio la detección de municipio y la dirección del GPS.
      libraries={['places', 'marker', 'geocoding']}
      onLoad={() => window.dispatchEvent(new Event('viviendas-perdidas:maps-ready'))}
    >
      <MapContent {...props} />
    </APIProvider>
  );
}
