import { defineSecret } from 'firebase-functions/params';

export const googleMapsServerApiKey: ReturnType<typeof defineSecret> = defineSecret(
  'GOOGLE_MAPS_SERVER_API_KEY',
);
