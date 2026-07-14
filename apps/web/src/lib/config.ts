type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

const env = import.meta.env;

const firebaseConfig: FirebasePublicConfig | null =
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_AUTH_DOMAIN &&
  env.VITE_FIREBASE_PROJECT_ID &&
  env.VITE_FIREBASE_APP_ID
    ? {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      }
    : null;

export const appConfig = {
  googleMapsApiKey: env.VITE_GOOGLE_MAPS_API_KEY?.trim() || null,
  googleMapsMapId: env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID',
  firebase: firebaseConfig,
  firebaseRegion: env.VITE_FIREBASE_REGION?.trim() || 'europe-west1',
  recaptchaSiteKey: env.VITE_RECAPTCHA_V3_SITE_KEY?.trim() || null,
  useFirebaseEmulators: env.VITE_USE_FIREBASE_EMULATORS === 'true',
  demoMode: env.VITE_DEMO_MODE === 'true' || firebaseConfig === null,
  publicExportUrl: env.VITE_PUBLIC_EXPORT_URL?.trim() || null,
  donation: {
    bizumPhone: env.VITE_DONATION_BIZUM_PHONE?.trim() || null,
    // External checkout (Stripe/Ko-fi/BMC) that accepts cards and Apple Pay.
    cardUrl: env.VITE_DONATION_CARD_URL?.trim() || null,
  },
} as const;

export const capabilityNotice = appConfig.demoMode
  ? 'Modo demostración: puedes explorar y probar el flujo; los cambios no se guardan.'
  : !appConfig.recaptchaSiteKey && !appConfig.useFirebaseEmulators
    ? 'Modo de solo lectura: falta configurar App Check para colaborar.'
    : !appConfig.googleMapsApiKey
      ? 'Mapa demostrativo activo: falta configurar Google Maps.'
      : null;
