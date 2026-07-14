import { useCallback, useEffect, useRef, useState } from 'react';
import type { Listing, ListingsService, MapBounds } from '../domain/types';

export function useListingsInBounds(service: ListingsService, bounds: MapBounds, enabled = true) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(() => {
    if (!enabled) {
      setListings([]);
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    void service
      .loadListings(bounds)
      .then((next) => {
        if (current === requestId.current) setListings(next);
      })
      .catch(() => {
        if (current === requestId.current)
          setError('No se han podido cargar los registros de esta zona.');
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false);
      });
  }, [bounds, enabled, service]);

  useEffect(() => {
    const timeout = window.setTimeout(reload, 180);
    return () => window.clearTimeout(timeout);
  }, [reload]);

  const insertOptimistic = useCallback((listing: Listing) => {
    setListings((current) => [listing, ...current.filter((entry) => entry.id !== listing.id)]);
  }, []);

  const updateListing = useCallback((id: string, patch: Partial<Listing>) => {
    setListings((current) =>
      current
        .map((listing) => (listing.id === id ? { ...listing, ...patch } : listing))
        .filter((listing) => listing.status !== 'removed'),
    );
  }, []);

  return { listings, loading, error, reload, insertOptimistic, updateListing };
}
