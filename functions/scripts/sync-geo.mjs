import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(functionsRoot, '../apps/web/public/geo');
const targetRoot = resolve(functionsRoot, 'geo');

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeRelativeGeoPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/geo/')) {
    throw new Error(`Ruta GeoJSON inválida en manifest: ${String(value)}`);
  }
  const relative = value.slice('/geo/'.length);
  const source = resolve(sourceRoot, relative);
  const expectedPrefix = `${sourceRoot}${sep}`;
  if (!source.startsWith(expectedPrefix)) {
    throw new Error(`La ruta GeoJSON sale del directorio permitido: ${value}`);
  }
  return { relative, source };
}

const manifestSource = resolve(sourceRoot, 'manifest.json');
const manifestText = await readFile(manifestSource, 'utf8');
const manifest = JSON.parse(manifestText);
if (!isRecord(manifest) || !Array.isArray(manifest.cities)) {
  throw new Error('apps/web/public/geo/manifest.json no contiene un array cities.');
}

await mkdir(targetRoot, { recursive: true });
for (const city of manifest.cities) {
  if (!isRecord(city) || typeof city.id !== 'string') {
    throw new Error('El manifiesto contiene una ciudad inválida.');
  }
  const { relative, source } = safeRelativeGeoPath(city.geoJsonUrl);
  const target = resolve(targetRoot, relative);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

await writeFile(resolve(targetRoot, 'manifest.json'), manifestText, 'utf8');
process.stdout.write(`Geodatos sincronizados para ${manifest.cities.length} ciudades.\n`);
