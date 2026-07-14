import { useEffect, useRef, useState } from 'react';
import type { CityDefinition, LatLng, ResolvedScope } from '../domain/types';
import { EMPTY_SCOPE } from '../lib/constants';
import { resolveVisibleScope } from '../lib/geo';

const INITIAL_SCOPE: ResolvedScope = {
  scope: EMPTY_SCOPE,
  city: null,
  neighborhoods: null,
  activeNeighborhood: null,
};

export function useVisibleScope(center: LatLng, zoom: number, cityHint?: CityDefinition | null) {
  const [resolved, setResolved] = useState<ResolvedScope>(INITIAL_SCOPE);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      void resolveVisibleScope(center, zoom, cityHint)
        .then((next) => {
          if (requestId.current === currentRequest) setResolved(next);
        })
        .finally(() => {
          if (requestId.current === currentRequest) setLoading(false);
        });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [center, zoom, cityHint]);

  return { ...resolved, loading };
}
