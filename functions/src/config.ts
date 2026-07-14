export const REGION = 'europe-southwest1';

export const HOUSEHOLD_SIZE = 2.5;

/** City-specific values can be introduced without changing persisted listings. */
export const HOUSEHOLD_SIZE_BY_CITY: Readonly<Record<string, number>> = {};

export const DUPLICATE_RADIUS_METERS = 25;
export const CREATE_LISTING_LIMIT_PER_HOUR = 5;
export const VOTE_LIMIT_PER_HOUR = 60;
export const PHOTO_SUBMIT_LIMIT_PER_HOUR = 5;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_PENDING_PHOTOS_PER_LISTING = 3;
export const PENDING_PHOTOS_PAGE_SIZE = 50;
export const FLAG_REPORT_THRESHOLD = 5;
export const REMOVE_REPORT_THRESHOLD = 15;
export const REPORT_TO_CONFIRMATION_RATIO = 2;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;
export const RATE_LIMIT_TTL_MS = 48 * 60 * 60 * 1_000;
export const FUNCTION_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export const SPAIN_BOUNDS = {
  minLatitude: 27.4,
  maxLatitude: 44.2,
  minLongitude: -18.5,
  maxLongitude: 4.5,
} as const;

export const PUBLIC_EXPORT_LIMIT = 10_000;
