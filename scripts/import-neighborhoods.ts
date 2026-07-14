#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;
type Position = [longitude: number, latitude: number];
type LinearRing = Position[];
type PolygonCoordinates = LinearRing[];
type MultiPolygonCoordinates = PolygonCoordinates[];

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
}

interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
}

type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

interface NormalizedFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    cityId: string;
  };
  geometry: SupportedGeometry;
}

interface NormalizedCollection {
  type: 'FeatureCollection';
  name: string;
  metadata: {
    schemaVersion: 1;
    cityId: string;
    cityName: string;
    representative: boolean;
    source: string;
  };
  features: NormalizedFeature[];
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface ImportOptions {
  inputPath: string;
  cityId: string;
  cityName: string;
  outputDirectory: string;
  manifestPath: string;
  baseUrl: string;
  source: string;
  representative: boolean;
  idField: string | undefined;
  nameField: string | undefined;
}

const ID_FIELD_CANDIDATES = [
  'id',
  'neighborhoodId',
  'neighbourhoodId',
  'barrio_id',
  'barri_id',
  'codigo',
  'codi',
  'code',
] as const;

const NAME_FIELD_CANDIDATES = [
  'name',
  'nombre',
  'nom',
  'neighborhood',
  'neighbourhood',
  'barrio',
  'barri',
] as const;

const HELP = `Normaliza polígonos de barrios y actualiza el manifiesto público.

Uso:
  npm run geo:import -- <entrada.geojson> --city-id <slug> --city-name <nombre> [opciones]

Opciones:
  --input <ruta>             Alternativa al argumento posicional de entrada.
  --city-id <slug>           Identificador estable del municipio (obligatorio).
  --city-name <nombre>       Nombre visible; por defecto se deriva del slug.
  --id-field <campo>         Propiedad de origen que contiene el id de barrio.
  --name-field <campo>       Propiedad de origen que contiene el nombre.
  --output-dir <ruta>        Por defecto apps/web/public/geo/<city-id>.
  --manifest <ruta>          Por defecto apps/web/public/geo/manifest.json.
  --base-url <url>           Por defecto /geo/<city-id>.
  --source <texto>           Atribución o procedencia del conjunto de datos.
  --representative           Marca geometrías de demostración, no oficiales.
  --help                     Muestra esta ayuda.

La salida contiene únicamente Polygon/MultiPolygon y propiedades
{ id, name, cityId }. Se escribe un alias neighborhoods.geojson y una copia
inmutable neighborhoods.<sha256-12>.geojson. Los ficheros hash antiguos no se
borran para no romper clientes que todavía los tengan referenciados.
`;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSlug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length === 0) {
    throw new Error(`No se puede generar un slug válido a partir de "${value}".`);
  }

  return normalized;
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function requireOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Falta el valor de ${option}.`);
  }
  return value;
}

function parseOptions(args: readonly string[]): ImportOptions {
  let inputPath: string | undefined;
  let rawCityId: string | undefined;
  let cityName: string | undefined;
  let outputDirectory: string | undefined;
  let manifestPath: string | undefined;
  let baseUrl: string | undefined;
  let source: string | undefined;
  let idField: string | undefined;
  let nameField: string | undefined;
  let representative = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (!argument.startsWith('--')) {
      if (inputPath !== undefined) {
        throw new Error(`Argumento posicional inesperado: ${argument}`);
      }
      inputPath = argument;
      continue;
    }

    if (argument === '--representative') {
      representative = true;
      continue;
    }

    const value = requireOptionValue(args, index, argument);
    index += 1;

    switch (argument) {
      case '--input':
        inputPath = value;
        break;
      case '--city-id':
        rawCityId = value;
        break;
      case '--city-name':
        cityName = value;
        break;
      case '--output-dir':
        outputDirectory = value;
        break;
      case '--manifest':
        manifestPath = value;
        break;
      case '--base-url':
        baseUrl = value;
        break;
      case '--source':
        source = value;
        break;
      case '--id-field':
        idField = value;
        break;
      case '--name-field':
        nameField = value;
        break;
      default:
        throw new Error(`Opción desconocida: ${argument}`);
    }
  }

  if (inputPath === undefined) {
    throw new Error('Debes indicar el GeoJSON de entrada. Usa --help para ver un ejemplo.');
  }
  if (rawCityId === undefined) {
    throw new Error('Debes indicar --city-id.');
  }

  const cityId = normalizeSlug(rawCityId);
  const resolvedOutput = resolve(outputDirectory ?? `apps/web/public/geo/${cityId}`);

  return {
    inputPath: resolve(inputPath),
    cityId,
    cityName: cityName?.trim() || titleFromSlug(cityId),
    outputDirectory: resolvedOutput,
    manifestPath: resolve(manifestPath ?? 'apps/web/public/geo/manifest.json'),
    baseUrl: (baseUrl ?? `/geo/${cityId}`).replace(/\/$/, ''),
    source: source?.trim() || `Importado desde ${basename(inputPath)}`,
    representative,
    idField,
    nameField,
  };
}

function propertyAsText(properties: JsonRecord, field: string): string | undefined {
  const value = properties[field];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function findProperty(
  properties: JsonRecord,
  explicitField: string | undefined,
  candidates: readonly string[],
): string | undefined {
  if (explicitField !== undefined) {
    return propertyAsText(properties, explicitField);
  }

  for (const candidate of candidates) {
    const value = propertyAsText(properties, candidate);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function normalizePosition(value: unknown, context: string): Position {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${context}: coordenada inválida.`);
  }

  const longitude = value[0];
  const latitude = value[1];
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(`${context}: longitud/latitud fuera de rango.`);
  }

  // Six decimal places retain roughly decimetre precision while keeping the
  // static payload and its content hash stable across noisy source exports.
  const roundedLongitude = Math.round(longitude * 1_000_000) / 1_000_000;
  const roundedLatitude = Math.round(latitude * 1_000_000) / 1_000_000;
  return [roundedLongitude, roundedLatitude];
}

function positionsEqual(first: Position, second: Position): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function normalizeRing(value: unknown, context: string): LinearRing {
  if (!Array.isArray(value)) {
    throw new Error(`${context}: el anillo no es un array.`);
  }

  const ring = value.map((position, index) =>
    normalizePosition(position, `${context}, coordenada ${index}`),
  );
  if (ring.length < 3) {
    throw new Error(`${context}: se necesitan al menos tres vértices.`);
  }

  const first = ring[0];
  const last = ring.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error(`${context}: anillo vacío.`);
  }
  if (!positionsEqual(first, last)) {
    ring.push([...first]);
  }
  if (ring.length < 4) {
    throw new Error(`${context}: el anillo cerrado necesita cuatro coordenadas.`);
  }

  return ring;
}

function normalizePolygonCoordinates(value: unknown, context: string): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${context}: el polígono no contiene anillos.`);
  }
  return value.map((ring, index) => normalizeRing(ring, `${context}, anillo ${index}`));
}

function normalizeGeometry(value: unknown, context: string): SupportedGeometry {
  if (!isRecord(value)) {
    throw new Error(`${context}: geometría ausente o inválida.`);
  }

  if (value.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: normalizePolygonCoordinates(value.coordinates, context),
    };
  }

  if (value.type === 'MultiPolygon') {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      throw new Error(`${context}: el multipolígono está vacío.`);
    }
    return {
      type: 'MultiPolygon',
      coordinates: value.coordinates.map((polygon, index) =>
        normalizePolygonCoordinates(polygon, `${context}, polígono ${index}`),
      ),
    };
  }

  throw new Error(`${context}: solo se admiten Polygon y MultiPolygon.`);
}

function normalizeFeature(
  value: unknown,
  index: number,
  options: ImportOptions,
): NormalizedFeature {
  const context = `Feature ${index}`;
  if (!isRecord(value) || value.type !== 'Feature') {
    throw new Error(`${context}: objeto Feature inválido.`);
  }
  if (!isRecord(value.properties)) {
    throw new Error(`${context}: properties debe ser un objeto.`);
  }

  const name = findProperty(value.properties, options.nameField, NAME_FIELD_CANDIDATES);
  if (name === undefined) {
    const hint = options.nameField ?? NAME_FIELD_CANDIDATES.join(', ');
    throw new Error(`${context}: falta un nombre de barrio (campos buscados: ${hint}).`);
  }

  const sourceId =
    findProperty(value.properties, options.idField, ID_FIELD_CANDIDATES) ??
    (typeof value.id === 'string' || typeof value.id === 'number' ? String(value.id) : name);

  return {
    type: 'Feature',
    properties: {
      id: normalizeSlug(sourceId),
      name,
      cityId: options.cityId,
    },
    geometry: normalizeGeometry(value.geometry, `${context} (${name})`),
  };
}

function normalizeCollection(input: unknown, options: ImportOptions): NormalizedCollection {
  if (!isRecord(input) || input.type !== 'FeatureCollection' || !Array.isArray(input.features)) {
    throw new Error('La entrada debe ser un GeoJSON FeatureCollection.');
  }
  if (input.features.length === 0) {
    throw new Error('El FeatureCollection no contiene barrios.');
  }

  const features = input.features
    .map((feature, index) => normalizeFeature(feature, index, options))
    .sort((first, second) => first.properties.id.localeCompare(second.properties.id, 'es'));

  const ids = new Set<string>();
  for (const feature of features) {
    if (ids.has(feature.properties.id)) {
      throw new Error(`Id de barrio duplicado tras normalizar: ${feature.properties.id}`);
    }
    ids.add(feature.properties.id);
  }

  return {
    type: 'FeatureCollection',
    name: `${options.cityId}-neighborhoods`,
    metadata: {
      schemaVersion: 1,
      cityId: options.cityId,
      cityName: options.cityName,
      representative: options.representative,
      source: options.source,
    },
    features,
  };
}

function everyPosition(geometry: SupportedGeometry): Position[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat();
  }
  return geometry.coordinates.flat(2);
}

function collectionBounds(collection: NormalizedCollection): Bounds {
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;

  for (const feature of collection.features) {
    for (const [longitude, latitude] of everyPosition(feature.geometry)) {
      north = Math.max(north, latitude);
      south = Math.min(south, latitude);
      east = Math.max(east, longitude);
      west = Math.min(west, longitude);
    }
  }

  return { north, south, east, west };
}

async function readManifestCities(manifestPath: string): Promise<JsonRecord[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!isRecord(parsed) || !Array.isArray(parsed.cities)) {
      throw new Error(`${manifestPath} no contiene un array cities.`);
    }
    return parsed.cities.filter(isRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function updateManifest(
  options: ImportOptions,
  collection: NormalizedCollection,
  digest: string,
): Promise<void> {
  const bounds = collectionBounds(collection);
  const priorCities = await readManifestCities(options.manifestPath);
  const city = {
    id: options.cityId,
    name: options.cityName,
    center: [(bounds.east + bounds.west) / 2, (bounds.north + bounds.south) / 2],
    bounds,
    geoJsonUrl: `${options.baseUrl}/neighborhoods.${digest.slice(0, 12)}.geojson`,
    fallbackGeoJsonUrl: `${options.baseUrl}/neighborhoods.geojson`,
    featureCount: collection.features.length,
    sha256: digest,
    representative: options.representative,
  };

  const cities = priorCities
    .filter((candidate) => candidate.id !== options.cityId)
    .concat(city)
    .sort((first, second) => String(first.id).localeCompare(String(second.id), 'es'));

  await mkdir(dirname(options.manifestPath), { recursive: true });
  await writeFile(
    options.manifestPath,
    `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), cities }, null, 2)}\n`,
    'utf8',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }

  const options = parseOptions(args);
  const input: unknown = JSON.parse(await readFile(options.inputPath, 'utf8'));
  const collection = normalizeCollection(input, options);
  const serialized = `${JSON.stringify(collection, null, 2)}\n`;
  const digest = createHash('sha256').update(serialized).digest('hex');
  const immutableFilename = `neighborhoods.${digest.slice(0, 12)}.geojson`;

  await mkdir(options.outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(options.outputDirectory, 'neighborhoods.geojson'), serialized, 'utf8'),
    writeFile(join(options.outputDirectory, immutableFilename), serialized, 'utf8'),
  ]);
  await updateManifest(options, collection, digest);

  process.stdout.write(
    `Importados ${collection.features.length} barrios de ${options.cityName}.\n` +
      `Alias: ${join(options.outputDirectory, 'neighborhoods.geojson')}\n` +
      `Inmutable: ${join(options.outputDirectory, immutableFilename)}\n`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error al importar barrios: ${message}\n`);
    process.exitCode = 1;
  });
}

export const __testing = {
  collectionBounds,
  normalizeCollection,
  normalizeSlug,
  parseOptions,
};
