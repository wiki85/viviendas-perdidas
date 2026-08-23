#!/usr/bin/env node
// Diagnóstico de solo lectura de la capa oficial: por cada ciudad de
// `officialStats` muestra el recuento sincronizado y, si hay histórico en
// `officialHistory`, el delta frente a la instantánea anterior.
//
// Uso seguro con emuladores (por defecto):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/estado-fuentes.mjs
//
// Contra producción (solo lectura, requiere credenciales de firebase-admin):
//   node scripts/estado-fuentes.mjs --project mapa-de-despoblacion --allow-production
//
// El script JAMÁS escribe. La guarda de producción evita conexiones
// accidentales al proyecto desplegado.

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
};

if (has('--help')) {
  console.log(
    `Estado de las sincronizaciones oficiales (solo lectura).

  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/estado-fuentes.mjs
  node scripts/estado-fuentes.mjs --project <id> --allow-production

Opciones:
  --project <id>        Proyecto Firebase (por defecto el del entorno o demo).
  --allow-production    Necesario para conectarse fuera del emulador.
  --json                Salida en JSON en vez de tabla.
  --help                Esta ayuda.`,
  );
  process.exit(0);
}

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId =
  value('--project') ??
  process.env.GCLOUD_PROJECT ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  'demo-viviendas-perdidas';

if (!usingEmulator && !has('--allow-production')) {
  console.error(
    'Sin FIRESTORE_EMULATOR_HOST y sin --allow-production: me niego a conectar a un proyecto real.\n' +
      'Arranca los emuladores (npm run emulators) o pasa --allow-production explícitamente.',
  );
  process.exit(1);
}

const app = initializeApp({ projectId });
const db = getFirestore(app);

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('es-ES') : '—';
}

try {
  const statsSnap = await db.collection('officialStats').get();
  if (statsSnap.empty) {
    console.log(`Sin documentos en officialStats (proyecto ${projectId}).`);
  } else {
    const rows = [];
    for (const doc of statsSnap.docs) {
      const s = doc.data();
      // Delta frente a la penúltima instantánea diaria de esta ciudad.
      const hist = await db
        .collection('officialHistory')
        .where('cityId', '==', doc.id)
        .orderBy('date', 'desc')
        .limit(2)
        .get();
      let delta = null;
      let prevDate = null;
      if (hist.size === 2) {
        const prev = hist.docs[1].data();
        prevDate = prev.date ?? null;
        if (typeof prev.total === 'number' && typeof s.total === 'number') {
          delta = s.total - prev.total;
        }
      }
      const updatedAt =
        s.updatedAt && typeof s.updatedAt.toDate === 'function'
          ? s.updatedAt.toDate().toISOString().slice(0, 10)
          : null;
      rows.push({
        cityId: doc.id,
        source: s.source ?? '—',
        total: s.total ?? null,
        entireHomes: s.entireHomes ?? null,
        dwellings: s.dwellings ?? null,
        withLocation: s.withLocation ?? null,
        updatedAt,
        prevDate,
        delta,
      });
    }
    rows.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    if (has('--json')) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.log(`Estado de la capa oficial · proyecto ${projectId}\n`);
      for (const r of rows) {
        const deltaTxt =
          r.delta === null ? '' : `  Δ ${r.delta >= 0 ? '+' : ''}${fmt(r.delta)} vs ${r.prevDate}`;
        const geo =
          r.total && r.withLocation !== null && r.withLocation !== undefined
            ? ` · ${Math.round((r.withLocation / r.total) * 100)}% ubicadas`
            : '';
        console.log(
          `${r.cityId.padEnd(22)} ${String(fmt(r.total)).padStart(8)} inscripciones` +
            ` (${fmt(r.dwellings)} viviendas)  [${r.source}]  act. ${r.updatedAt ?? '—'}${geo}${deltaTxt}`,
        );
      }
      console.log(`\n${rows.length} municipios espejados.`);
    }
  }
} catch (err) {
  console.error('Error consultando Firestore:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
