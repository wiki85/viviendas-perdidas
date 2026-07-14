import { useEffect, useState } from 'react';
import type { Aggregate, ListingsService, VisibleScope } from '../domain/types';

function emptyAggregate(scope: VisibleScope): Aggregate {
  return {
    ...scope,
    listingsCount: 0,
    lostDwellings: 0,
    lostFamilies: 0,
    lostInhabitants: 0,
    lostCommercial: 0,
    updatedAt: null,
  };
}

export function useAggregate(service: ListingsService, scope: VisibleScope) {
  const [aggregate, setAggregate] = useState<Aggregate>(() => emptyAggregate(scope));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setAggregate(emptyAggregate(scope));
    return service.subscribeAggregate(
      scope,
      (next) => {
        setAggregate(next);
        setLoading(false);
      },
      () => {
        setError('No se han podido actualizar los contadores.');
        setLoading(false);
      },
    );
  }, [scope, service]);

  return { aggregate, loading, error };
}
