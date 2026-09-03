import { useEffect, useState } from 'react';

/** Punto de corte entre la disposición móvil y la de escritorio. */
export const DESKTOP_QUERY = '(min-width: 760px)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false);
}

/** `true` mientras la media query se cumple; se actualiza al redimensionar. */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setValue(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return value;
}
