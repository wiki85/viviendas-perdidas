import { useEffect, useState } from 'react';
import type { LatLng } from '../domain/types';
import { appConfig } from '../lib/config';
import { distanceMeters } from '../lib/geo';
import {
  bearingBetween,
  fetchStreetViewMetadata,
  type StreetViewMetadata,
} from '../lib/streetview';

const UNAVAILABLE: StreetViewMetadata = { available: false, panoId: null, location: null };
// Beyond this distance the nearest panorama is on another street (common on
// pedestrian streets) and would preview the wrong facade.
const MAX_PANORAMA_DISTANCE_METERS = 40;

export function useStreetView(position: LatLng | null) {
  const [metadata, setMetadata] = useState<StreetViewMetadata>(UNAVAILABLE);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!position || !appConfig.googleMapsApiKey) {
      setMetadata(UNAVAILABLE);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchStreetViewMetadata(position, appConfig.googleMapsApiKey, controller.signal)
      .then((next) => {
        if (
          next.available &&
          next.location &&
          distanceMeters(next.location, position) > MAX_PANORAMA_DISTANCE_METERS
        ) {
          setMetadata(UNAVAILABLE);
          return;
        }
        setMetadata(next);
        if (next.location) setHeading(bearingBetween(next.location, position));
      })
      .catch((caught: unknown) => {
        if ((caught as { name?: string }).name !== 'AbortError') {
          setError('No se pudo comprobar la cobertura. Puedes registrar igualmente.');
          setMetadata(UNAVAILABLE);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [position]);

  return { metadata, heading, setHeading, loading, error };
}
