import { useEffect, useRef, useState } from 'react';
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
  const [retryNonce, setRetryNonce] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    attemptsRef.current = 0;
    // Adopt the new scope's identity (name, level, ids) immediately: only
    // the figures wait for the snapshot, keeping their previous values
    // instead of dropping to zero.
    setAggregate((previous) => ({
      ...previous,
      scopeId: scope.scopeId,
      scope: scope.scope,
      cityId: scope.cityId,
      neighborhoodId: scope.neighborhoodId,
      name: scope.name,
    }));
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Keep the previous figures while the new scope loads: dropping to zero
    // reads as data loss and re-animates every counter on each pan.
    let retryTimer: number | null = null;
    const unsubscribe = service.subscribeAggregate(
      scope,
      (next) => {
        attemptsRef.current = 0;
        setAggregate(next);
        setLoading(false);
      },
      () => {
        setError('No se han podido actualizar los contadores.');
        setLoading(false);
        // A Firestore listener error is terminal for the SDK: without this
        // retry the counters would stay frozen until the scope changes.
        if (attemptsRef.current < 3) {
          attemptsRef.current += 1;
          retryTimer = window.setTimeout(
            () => setRetryNonce((nonce) => nonce + 1),
            4_000 * attemptsRef.current,
          );
        }
      },
    );
    return () => {
      unsubscribe();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [retryNonce, scope, service]);

  return { aggregate, loading, error };
}
