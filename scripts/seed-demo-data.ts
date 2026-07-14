#!/usr/bin/env node

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';

type ListingType = 'unit' | 'building';
type Platform = 'airbnb' | 'booking' | 'otra' | null;

interface DemoListing {
  id: string;
  type: ListingType;
  dwellingsCount: number;
  address: {
    formatted: string;
    street: string;
    number: string;
    postalCode: string;
    locality: string;
    province: string;
  };
  latitude: number;
  longitude: number;
  neighborhoodId: string;
  cityId: string;
  licenseNumber: string | null;
  platform: Platform;
  note: string | null;
  createdAt: string;
}

interface SeedOptions {
  projectId: string;
  allowProduction: boolean;
  dryRun: boolean;
}

const HELP = `Carga registros ficticios y deterministas en Firestore.

Uso seguro con emuladores:
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:demo

Opciones:
  --project <id>        Proyecto Firebase (por defecto variables de entorno o
                        demo-viviendas-perdidas).
  --dry-run             Valida y muestra el resumen sin escribir.
  --allow-production    Permite apuntar fuera del emulador solamente cuando
                        CONFIRM_PRODUCTION_SEED coincide exactamente con el id.
  --help                Muestra esta ayuda.

El script solo escribe listings con ids prefijados por "demo-". Los agregados
los genera onListingWrite; arranca también el emulador de Functions al sembrar.
`;

const DEMO_LISTINGS: readonly DemoListing[] = [
  {
    id: 'demo-madrid-lavapies-unit',
    type: 'unit',
    dwellingsCount: 1,
    address: {
      formatted: 'Calle de la Fe, 10, 28012 Madrid, España',
      street: 'Calle de la Fe',
      number: '10',
      postalCode: '28012',
      locality: 'Madrid',
      province: 'Madrid',
    },
    latitude: 40.4086,
    longitude: -3.7003,
    neighborhoodId: 'lavapies',
    cityId: 'madrid',
    licenseNumber: 'DEMO-VT-0001',
    platform: 'airbnb',
    note: 'Registro ficticio para probar la interfaz.',
    createdAt: '2026-07-01T10:00:00.000Z',
  },
  {
    id: 'demo-madrid-chamberi-building',
    type: 'building',
    dwellingsCount: 8,
    address: {
      formatted: 'Calle de Ponzano, 45, 28003 Madrid, España',
      street: 'Calle de Ponzano',
      number: '45',
      postalCode: '28003',
      locality: 'Madrid',
      province: 'Madrid',
    },
    latitude: 40.4384,
    longitude: -3.6996,
    neighborhoodId: 'chamberi',
    cityId: 'madrid',
    licenseNumber: null,
    platform: 'otra',
    note: 'Edificio ficticio de demostración.',
    createdAt: '2026-07-02T11:00:00.000Z',
  },
  {
    id: 'demo-barcelona-gracia-unit',
    type: 'unit',
    dwellingsCount: 1,
    address: {
      formatted: 'Carrer de Verdi, 32, 08012 Barcelona, España',
      street: 'Carrer de Verdi',
      number: '32',
      postalCode: '08012',
      locality: 'Barcelona',
      province: 'Barcelona',
    },
    latitude: 41.404,
    longitude: 2.157,
    neighborhoodId: 'gracia',
    cityId: 'barcelona',
    licenseNumber: 'DEMO-HUTB-0002',
    platform: 'booking',
    note: 'Registro ficticio para probar la interfaz.',
    createdAt: '2026-07-03T12:00:00.000Z',
  },
  {
    id: 'demo-barcelona-eixample-building',
    type: 'building',
    dwellingsCount: 10,
    address: {
      formatted: 'Carrer de Mallorca, 236, 08008 Barcelona, España',
      street: 'Carrer de Mallorca',
      number: '236',
      postalCode: '08008',
      locality: 'Barcelona',
      province: 'Barcelona',
    },
    latitude: 41.3916,
    longitude: 2.163,
    neighborhoodId: 'eixample',
    cityId: 'barcelona',
    licenseNumber: null,
    platform: 'airbnb',
    note: 'Edificio ficticio de demostración.',
    createdAt: '2026-07-04T13:00:00.000Z',
  },
  {
    id: 'demo-valencia-russafa-building',
    type: 'building',
    dwellingsCount: 12,
    address: {
      formatted: 'Carrer de Cadis, 46, 46006 València, España',
      street: 'Carrer de Cadis',
      number: '46',
      postalCode: '46006',
      locality: 'València',
      province: 'València',
    },
    latitude: 39.4608,
    longitude: -0.3749,
    neighborhoodId: 'russafa',
    cityId: 'valencia',
    licenseNumber: 'DEMO-VT-0003',
    platform: 'airbnb',
    note: 'Edificio ficticio para validar el incremento de doce viviendas.',
    createdAt: '2026-07-05T14:00:00.000Z',
  },
  {
    id: 'demo-valencia-el-carme-unit',
    type: 'unit',
    dwellingsCount: 1,
    address: {
      formatted: 'Carrer dels Serrans, 18, 46003 València, España',
      street: 'Carrer dels Serrans',
      number: '18',
      postalCode: '46003',
      locality: 'València',
      province: 'València',
    },
    latitude: 39.478,
    longitude: -0.3767,
    neighborhoodId: 'el-carme',
    cityId: 'valencia',
    licenseNumber: null,
    platform: null,
    note: 'Registro ficticio para probar la interfaz.',
    createdAt: '2026-07-06T15:00:00.000Z',
  },
] as const;

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(latitude: number, longitude: number, precision = 10): string {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`Coordenadas fuera de rango: ${latitude}, ${longitude}`);
  }
  if (!Number.isInteger(precision) || precision < 1 || precision > 22) {
    throw new Error(`Precisión de geohash inválida: ${precision}`);
  }

  const latitudeRange: [number, number] = [-90, 90];
  const longitudeRange: [number, number] = [-180, 180];
  let evenBit = true;
  let currentCharacter = 0;
  let bit = 0;
  let geohash = '';

  while (geohash.length < precision) {
    const range = evenBit ? longitudeRange : latitudeRange;
    const coordinate = evenBit ? longitude : latitude;
    const midpoint = (range[0] + range[1]) / 2;

    currentCharacter = (currentCharacter << 1) | (coordinate >= midpoint ? 1 : 0);
    if (coordinate >= midpoint) {
      range[0] = midpoint;
    } else {
      range[1] = midpoint;
    }

    evenBit = !evenBit;
    bit += 1;
    if (bit === 5) {
      const character = GEOHASH_BASE32[currentCharacter];
      if (character === undefined) {
        throw new Error('No se pudo codificar el geohash.');
      }
      geohash += character;
      bit = 0;
      currentCharacter = 0;
    }
  }

  return geohash;
}

function optionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Falta el valor de ${option}.`);
  }
  return value;
}

function parseOptions(args: readonly string[]): SeedOptions {
  let projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    'demo-viviendas-perdidas';
  let allowProduction = false;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    switch (argument) {
      case '--project':
        projectId = optionValue(args, index, '--project');
        index += 1;
        break;
      case '--allow-production':
        allowProduction = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        throw new Error(`Opción desconocida: ${String(argument)}`);
    }
  }

  if (projectId.trim().length === 0) {
    throw new Error('El id de proyecto no puede estar vacío.');
  }

  return { projectId: projectId.trim(), allowProduction, dryRun };
}

function validateSafety(options: SeedOptions): void {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  if (emulatorHost !== undefined && emulatorHost.length > 0) {
    return;
  }

  if (!options.allowProduction) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST no está definido. Usa el emulador o confirma explícitamente producción.',
    );
  }

  if (process.env.CONFIRM_PRODUCTION_SEED !== options.projectId) {
    throw new Error(
      `Para producción, CONFIRM_PRODUCTION_SEED debe coincidir exactamente con "${options.projectId}".`,
    );
  }
}

function validateDemoListings(): void {
  const ids = new Set<string>();
  for (const listing of DEMO_LISTINGS) {
    if (ids.has(listing.id)) {
      throw new Error(`Id demo duplicado: ${listing.id}`);
    }
    ids.add(listing.id);

    if (listing.type === 'unit' && listing.dwellingsCount !== 1) {
      throw new Error(`${listing.id}: una unidad debe tener dwellingsCount=1.`);
    }
    if (
      listing.type === 'building' &&
      (listing.dwellingsCount < 1 || listing.dwellingsCount > 500)
    ) {
      throw new Error(`${listing.id}: dwellingsCount fuera de 1–500.`);
    }
    if (listing.note !== null && listing.note.length > 280) {
      throw new Error(`${listing.id}: la nota supera 280 caracteres.`);
    }
    if (Number.isNaN(Date.parse(listing.createdAt))) {
      throw new Error(`${listing.id}: createdAt no es una fecha ISO válida.`);
    }
    encodeGeohash(listing.latitude, listing.longitude);
  }
}

async function seed(options: SeedOptions): Promise<void> {
  validateSafety(options);
  validateDemoListings();

  const totalDwellings = DEMO_LISTINGS.reduce(
    (total, listing) => total + listing.dwellingsCount,
    0,
  );
  const summary = `${DEMO_LISTINGS.length} listings demo (${totalDwellings} viviendas) en ${options.projectId}`;

  if (options.dryRun) {
    process.stdout.write(`Validación correcta: ${summary}. No se ha escrito nada.\n`);
    return;
  }

  const app = initializeApp({ projectId: options.projectId });
  try {
    const firestore = getFirestore(app);
    const batch = firestore.batch();

    for (const listing of DEMO_LISTINGS) {
      const createdAt = Timestamp.fromDate(new Date(listing.createdAt));
      batch.set(firestore.collection('listings').doc(listing.id), {
        type: listing.type,
        dwellingsCount: listing.dwellingsCount,
        address: listing.address,
        location: new GeoPoint(listing.latitude, listing.longitude),
        geohash: encodeGeohash(listing.latitude, listing.longitude),
        neighborhoodId: listing.neighborhoodId,
        cityId: listing.cityId,
        streetView: {
          available: false,
          panoId: null,
          heading: null,
        },
        evidence: {
          licenseNumber: listing.licenseNumber,
          platform: listing.platform,
          note: listing.note,
        },
        status: 'active',
        confirmations: 0,
        reports: 0,
        createdAt,
        updatedAt: createdAt,
      });
    }

    await batch.commit();
    process.stdout.write(
      `Sembrados ${summary}. onListingWrite mantendrá los agregados de ciudad y barrio.\n`,
    );
  } finally {
    await deleteApp(app);
  }
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  process.stdout.write(HELP);
} else {
  seed(parseOptions(args)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error al sembrar datos demo: ${message}\n`);
    process.exitCode = 1;
  });
}

export const __testing = {
  DEMO_LISTINGS,
  encodeGeohash,
  parseOptions,
  validateDemoListings,
};
