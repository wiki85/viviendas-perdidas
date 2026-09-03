import type { ListingType } from '../../domain/types';
import { GLYPH_PATHS, GLYPH_TRANSFORM, PIN_OUTLINE } from '../../lib/marker-icons';

/** Versión React del pin (mapa de demostración); comparte trazados con el real. */
export function PinGlyph({ type }: { type: ListingType }) {
  return (
    <svg viewBox="0 0 36 46" aria-hidden="true" focusable="false">
      <path className="pin__shape" d={PIN_OUTLINE} />
      <g
        className="pin__glyph"
        transform={GLYPH_TRANSFORM}
        dangerouslySetInnerHTML={{ __html: GLYPH_PATHS[type] }}
      />
    </svg>
  );
}
