import { describe, expect, it } from 'vitest';
import { createListingSchema } from './schemas.js';

const basePayload = {
  type: 'unit' as const,
  dwellingsCount: 1,
  location: { lat: 39.46, lng: -0.37 },
};

describe('createListingSchema', () => {
  it.each(['VT-12345-V', 'VFT/MA/012345', 'HUTB-123456'])(
    'accepts a plausible tourism licence: %s',
    (licenseNumber) => {
      expect(
        createListingSchema.safeParse({
          ...basePayload,
          evidence: { licenseNumber },
        }).success,
      ).toBe(true);
    },
  );

  it.each(['612345678', 'María Pérez', 'nombre@example.com', 'VT 12345'])(
    'rejects a licence field that could contain personal or unstructured data: %s',
    (licenseNumber) => {
      expect(
        createListingSchema.safeParse({
          ...basePayload,
          evidence: { licenseNumber },
        }).success,
      ).toBe(false);
    },
  );

  it('accepts a payload whose evidence arrives as null (SDK encodes undefined as null)', () => {
    expect(
      createListingSchema.safeParse({
        type: 'building',
        dwellingsCount: 4,
        placeId: 'ChIJn0y20vdrEg0RFa_mzwGLkak',
        evidence: null,
        streetViewHeading: 125,
        duplicateAcknowledged: false,
      }).success,
    ).toBe(true);
  });

  it('accepts coordinates together with a placeId to pin the exact portal', () => {
    expect(
      createListingSchema.safeParse({
        ...basePayload,
        placeId: 'ChIJn0y20vdrEg0RFa_mzwGLkak',
      }).success,
    ).toBe(true);
  });

  it('rejects an address combined with a placeId', () => {
    expect(
      createListingSchema.safeParse({
        ...basePayload,
        address: 'Calle Clavijo 4, Sevilla',
        placeId: 'ChIJn0y20vdrEg0RFa_mzwGLkak',
      }).success,
    ).toBe(false);
  });

  it('accepts a converted commercial premises declaring several locales', () => {
    expect(
      createListingSchema.safeParse({
        ...basePayload,
        type: 'commercial',
        commercialUnitsCount: 3,
      }).success,
    ).toBe(true);
  });

  it('rejects a converted commercial premises declaring zero locales', () => {
    expect(
      createListingSchema.safeParse({
        ...basePayload,
        type: 'commercial',
        commercialUnitsCount: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects an individual apartment declaring locales', () => {
    expect(
      createListingSchema.safeParse({
        ...basePayload,
        commercialUnitsCount: 2,
      }).success,
    ).toBe(false);
  });
});
