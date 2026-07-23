import { db } from '../firebase.js';
import { normalizeStreet, normalizeStreetNumber } from '../domain/address.js';
import { normalizeLicenseKey, streetsLooselyMatch } from '../domain/openrta.js';
import type { ListingAddress } from '../types.js';

export interface OfficialVutMatch {
  registrationCode: string;
  addressText: string;
  places: number;
  entire: boolean;
}

/**
 * Looks for an official VUT registered at the same street + number in the
 * same municipality. Postal code agreement breaks ties between candidates.
 */
export async function findOfficialVutMatch(
  cityId: string,
  address: ListingAddress,
): Promise<OfficialVutMatch | null> {
  const number = normalizeStreetNumber(address.number);
  if (number.length === 0) return null;
  const snapshot = await db
    .collection('officialVut')
    .where('cityId', '==', cityId)
    .where('number', '==', number)
    .limit(50)
    .get();
  if (snapshot.empty) return null;
  const street = normalizeStreet(address.street);
  const candidates = snapshot.docs
    .map((doc) => doc.data())
    .filter((data) => streetsLooselyMatch(street, String(data.street ?? '')));
  if (candidates.length === 0) return null;
  const best =
    candidates.find((data) => String(data.postalCode ?? '') === address.postalCode) ??
    candidates[0];
  if (best === undefined) return null;
  return {
    registrationCode: String(best.registrationCode ?? ''),
    addressText: String(best.addressText ?? ''),
    places: typeof best.places === 'number' ? best.places : 0,
    entire: best.entire === true,
  };
}

/** True when the licence exists in the mirrored official registry. */
export async function licenseExistsInRta(licenseNumber: string): Promise<boolean> {
  const key = normalizeLicenseKey(licenseNumber);
  if (key.length < 5) return false;
  const snapshot = await db.collection('officialVut').where('licenseKey', '==', key).limit(1).get();
  return !snapshot.empty;
}
