import { escapeHtml } from './html.js';
import { pageShell } from './render-city.js';

/**
 * /fuentes — the transparency page: every autonomous-community source the
 * map synchronizes, what it serves, how we geolocate it, what broke, what
 * the administration could improve, and a 0-100 score under a rubric shared
 * by all sources.
 *
 * OBLIGACIÓN DE MANTENIMIENTO: si una fuente cambia (URL, esquema, cadencia,
 * licencia) o se integra una comunidad nueva, esta página DEBE actualizarse
 * en el mismo cambio. El aviso equivalente vive junto a getSyncConfig() en
 * services/official-sync.ts.
 */

/** Máximos por criterio de la rúbrica común (suman 100). */
export const RUBRIC = [
  {
    key: 'ubicacion',
    label: 'Ubicación de las viviendas',
    max: 25,
    detail:
      'Coordenadas publicadas por la propia fuente (25) o referencia catastral resoluble (20); parciales puntúan proporcionalmente; solo dirección postal, casi nada.',
  },
  {
    key: 'identificador',
    label: 'Identificador registral estable',
    max: 15,
    detail:
      'Signatura oficial única y persistente que permite seguir cada vivienda entre sincronizaciones sin inventar claves.',
  },
  {
    key: 'riqueza',
    label: 'Riqueza de los datos',
    max: 20,
    detail:
      'Plazas/capacidad, modalidad separable (vivienda completa vs habitaciones), dirección completa.',
  },
  {
    key: 'frecuencia',
    label: 'Frecuencia de actualización',
    max: 20,
    detail: 'Diaria o continua (20), semanal (15), mensual (10), semestral (5), estancada (0).',
  },
  {
    key: 'acceso',
    label: 'Acceso técnico',
    max: 10,
    detail:
      'Descarga o API estable y documentada en un portal de datos abiertos, sin sesiones ni trucos.',
  },
  {
    key: 'licencia',
    label: 'Licencia de reutilización',
    max: 10,
    detail: 'Licencia abierta explícita (CC BY o equivalente) frente a avisos legales ambiguos.',
  },
] as const;

type ScoreKey = (typeof RUBRIC)[number]['key'];

export interface SourceEntry {
  id: string;
  ccaa: string;
  registro: string;
  cities: string;
  links: Array<{ label: string; url: string }>;
  datos: string[];
  posicionamiento: string;
  problemas: string[];
  mejoras: string[];
  frecuencia: string;
  licencia: string;
  score: Record<ScoreKey, number>;
}

export const SOURCES: SourceEntry[] = [
  {
    id: 'rta',
    ccaa: 'Andalucía',
    registro: 'Registro de Turismo de Andalucía (RTA) — Junta de Andalucía',
    cities: 'Sevilla, Málaga, Granada, Córdoba, Cádiz, Huelva, Jaén, Almería, Jerez y Marbella',
    links: [
      {
        label: 'Dataset OpenRTA (datos.gob.es)',
        url: 'https://datos.gob.es/es/catalogo/a01002820-openrta',
      },
    ],
    datos: [
      'Número de registro estable, modalidad (vivienda completa o por habitaciones), plazas, dirección postal completa y coordenadas para la mayoría de altas.',
    ],
    posicionamiento:
      'La mayoría de viviendas llegan con coordenadas de la propia Junta (validadas contra un radio municipal de plausibilidad); los huecos se resuelven con CartoCiudad (IGN) y, como último recurso, geocodificación comercial.',
    problemas: [
      'Un pequeño porcentaje de coordenadas cae fuera del municipio declarado y hay que descartarlas y re-geocodificarlas.',
      'El volcado completo es pesado y ocasionalmente devuelve errores transitorios que obligan a reintentar.',
    ],
    mejoras: [
      'Publicar la referencia catastral junto a cada alta cerraría el hueco de coordenadas sin coste.',
      'Documentar un campo de fecha de última modificación por registro facilitaría sincronizaciones incrementales.',
    ],
    frecuencia: 'Continua (el registro se consulta en vivo); nosotros sincronizamos cada lunes.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 20,
      identificador: 15,
      riqueza: 17,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'gva',
    ccaa: 'Comunitat Valenciana',
    registro: 'Registre de Turisme de la Comunitat Valenciana — Generalitat Valenciana',
    cities: 'València, Alicante, Benidorm, Torrevieja, Calp y Dénia',
    links: [
      {
        label: 'Dataset diario (dadesobertes.gva.es)',
        url: 'https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51',
      },
    ],
    datos: [
      'Signatura registral, dirección, código postal, municipio (código INE), dormitorios, plazas y — la joya — referencia catastral en el ~99% de filas. La figura valenciana siempre cede la vivienda completa.',
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela), que da ubicación a nivel de portal sin coste; el resto va a CartoCiudad y geocodificación comercial.',
    problemas: [
      'El registro no publica coordenadas directamente: dependemos del Catastro, con un presupuesto de consultas por sincronización que hace que los municipios grandes tarden varias pasadas en quedar completos.',
      'El endpoint JSON moderno del Catastro falla sistemáticamente; hay que usar el servicio XML clásico.',
    ],
    mejoras: [
      'Incluir las coordenadas ya resueltas en el propio CSV diario ahorraría miles de consultas al Catastro a todos los reutilizadores.',
    ],
    frecuencia: 'Volcado diario; nosotros sincronizamos cada miércoles.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 20,
      identificador: 15,
      riqueza: 16,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'cat',
    ccaa: 'Cataluña',
    registro: 'Registre de Turisme de Catalunya (RTC) — Generalitat de Catalunya',
    cities: 'Barcelona, Girona y Tarragona',
    links: [
      {
        label: 'Dataset Socrata (analisi.transparenciacatalunya.cat)',
        url: 'https://analisi.transparenciacatalunya.cat/d/t2h3-cgys',
      },
      {
        label: 'Coordenadas del Ajuntament de Barcelona (Open Data BCN)',
        url: 'https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic',
      },
    ],
    datos: [
      "Número de inscripción estable, modalidad separable (habitatge d'ús turístic vs llar compartida), dirección con piso y puerta, código postal y plazas en la mayoría de filas.",
    ],
    posicionamiento:
      'En Barcelona cruzamos por número de registro con el dataset municipal del Ajuntament, que sí publica coordenadas (100% ubicadas). En Girona y Tarragona el registro no trae coordenadas y geocodificamos por dirección con CartoCiudad y geocodificación comercial en varias pasadas.',
    problemas: [
      'El registro autonómico no publica coordenadas ni referencia catastral: fuera de Barcelona toda la ubicación corre de nuestra cuenta.',
      'Una parte de las altas no declara la capacidad (plazas), pese a ser un dato del registro.',
    ],
    mejoras: [
      'Publicar coordenadas o referencia catastral para toda Cataluña, como ya hace el Ajuntament de Barcelona con su término municipal.',
      'Completar el campo de plazas en todas las altas.',
    ],
    frecuencia: 'Dataset actualizado a diario; nosotros sincronizamos cada martes.',
    licencia:
      "Llicència oberta d'ús d'informació – Catalunya (equivalente a CC BY); coordenadas municipales CC BY 4.0.",
    score: {
      ubicacion: 10,
      identificador: 15,
      riqueza: 16,
      frecuencia: 20,
      acceso: 9,
      licencia: 9,
    },
  },
  {
    id: 'caib',
    ccaa: 'Illes Balears (Mallorca)',
    registro: "Registre insular d'habitatges turístics de Mallorca — Consell de Mallorca",
    cities: 'Palma, Calvià y Alcúdia',
    links: [
      {
        label: 'GeoJSON del catálogo CAIB',
        url: 'https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca',
      },
    ],
    datos: [
      'Signatura, grupo de alta (ETV/ETVPL/ETV60/habitatge turístic — siempre vivienda completa), dirección, municipio, plazas y coordenadas WGS84 en aproximadamente la mitad de las fichas.',
    ],
    posicionamiento:
      'Usamos las coordenadas del propio registre cuando existen y son plausibles; la otra mitad se geocodifica por dirección (CartoCiudad y geocodificación comercial).',
    problemas: [
      'Solo la mitad de las fichas traen geometría; el resto depende de direcciones a veces incompletas.',
      'El mismo catálogo mezcla operadores comerciales («comercialitzadors») con viviendas: hay que filtrar por grupo para no inflar el recuento.',
    ],
    mejoras: [
      'Georreferenciar el 100% de las fichas (el propio Consell ya lo hace con la mitad).',
      'Separar en datasets distintos las viviendas de los operadores comerciales.',
    ],
    frecuencia:
      'Catálogo con refresco frecuente (declarado diario); nosotros sincronizamos cada jueves.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 14,
      identificador: 15,
      riqueza: 15,
      frecuencia: 15,
      acceso: 8,
      licencia: 10,
    },
  },
  {
    id: 'nav',
    ccaa: 'Navarra',
    registro: 'Registro de Turismo de Navarra — Gobierno de Navarra',
    cities: 'Pamplona',
    links: [
      {
        label: 'Dataset CKAN (datosabiertos.navarra.es)',
        url: 'https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra',
      },
    ],
    datos: [
      'Número de registro, modalidad (apartamento turístico, vivienda turística y variantes rurales, separables), dirección, municipio y plazas.',
    ],
    posicionamiento:
      'El dataset no publica coordenadas: geocodificamos cada dirección con CartoCiudad (IGN) y verificación de municipio, con geocodificación comercial de respaldo.',
    problemas: [
      'Sin coordenadas ni referencia catastral: toda la ubicación es trabajo del reutilizador.',
      'El dataset mezcla todos los tipos de alojamiento y hay que filtrar las modalidades de vivienda.',
    ],
    mejoras: ['Añadir coordenadas o referencia catastral a cada alta del registro.'],
    frecuencia: 'Actualización diaria vía API CKAN; nosotros sincronizamos cada viernes.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 5,
      identificador: 15,
      riqueza: 15,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'eus',
    ccaa: 'Euskadi',
    registro: 'Registro de Empresas y Actividades Turísticas de Euskadi (REATE) — Gobierno Vasco',
    cities: 'Donostia / San Sebastián y Bilbao',
    links: [
      {
        label: 'Dataset de viviendas y habitaciones (Open Data Euskadi)',
        url: 'https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/',
      },
    ],
    datos: [
      'Número de registro, capacidad, dirección, código de municipio, y — modelado ejemplar — dos ficheros separados para viviendas completas y para habitaciones en vivienda particular, con número de habitaciones.',
    ],
    posicionamiento:
      'Sin coordenadas en origen: geocodificamos por dirección con CartoCiudad y respaldo comercial. Bilbao y Donostia están hoy al 99-100% tras varias pasadas.',
    problemas: [
      'Sin coordenadas ni referencia catastral.',
      'Existe un dataset hermano de «alojamientos turísticos» con coordenadas que NO incluye las viviendas de uso turístico — una trampa clásica para reutilizadores.',
    ],
    mejoras: [
      'Incorporar las VUT al dataset georreferenciado de alojamientos, o añadir coordenadas al dataset específico.',
    ],
    frecuencia: 'Actualización periódica (aprox. semanal); nosotros sincronizamos cada sábado.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 5,
      identificador: 15,
      riqueza: 17,
      frecuencia: 13,
      acceso: 8,
      licencia: 10,
    },
  },
  {
    id: 'mad',
    ccaa: 'Comunidad de Madrid',
    registro: 'Declaraciones responsables de viviendas de uso turístico — Comunidad de Madrid',
    cities: 'Madrid',
    links: [
      {
        label: 'Dataset (datos.comunidad.madrid)',
        url: 'https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico',
      },
    ],
    datos: [
      'Únicamente tipo de alojamiento, vía, número y localidad. Sin número de registro, sin plazas, sin coordenadas, sin referencia catastral.',
    ],
    posicionamiento:
      'Construimos un identificador sintético a partir de la dirección normalizada y geocodificamos todo: primero CartoCiudad (IGN) con verificación de municipio y después geocodificación comercial. Madrid está hoy al 100% ubicado, con precisión de portal.',
    problemas: [
      'El CSV es una instantánea del listado vigente que se sobreescribe: sin identificador estable, cualquier corrección de dirección parece un alta más una baja.',
      'Codificación de texto inconsistente entre ficheros (mezcla de UTF-8 y Latin-1) y dos esquemas de columnas distintos según el mes.',
      'Sin plazas, es imposible estimar la capacidad turística real de la ciudad desde la fuente oficial.',
    ],
    mejoras: [
      'Publicar el número de expediente o registro de cada declaración (existe en el procedimiento administrativo).',
      'Añadir plazas, coordenadas o referencia catastral.',
      'Mantener un histórico acumulado en lugar de sobreescribir la instantánea mensual.',
    ],
    frecuencia:
      'Instantánea del listado vigente con refresco aproximadamente mensual; nosotros sincronizamos cada domingo.',
    licencia: 'CC BY 4.0',
    score: { ubicacion: 4, identificador: 0, riqueza: 5, frecuencia: 10, acceso: 8, licencia: 10 },
  },
];

export function sourceTotal(entry: SourceEntry): number {
  return RUBRIC.reduce((sum, criterion) => sum + entry.score[criterion.key], 0);
}

/** Fecha de la última revisión editorial de esta página. */
const LAST_REVIEW = '4 de agosto de 2026';

const scoreColor = (pct: number) => (pct >= 75 ? '#315d4c' : pct >= 50 ? '#a06b1f' : '#9b3b30');

export function renderSourcesPage(): string {
  const ranked = [...SOURCES].sort((a, b) => sourceTotal(b) - sourceTotal(a));

  const rankingRows = ranked
    .map((entry, index) => {
      const total = sourceTotal(entry);
      return `
        <tr>
          <td>${index + 1}</td>
          <td><a href="#fuente-${entry.id}">${escapeHtml(entry.ccaa)}</a></td>
          <td class="num"><strong style="color:${scoreColor(total)}">${total}</strong>/100</td>
          <td><span style="display:block;height:8px;background:rgba(30,43,39,.08);border-radius:4px"><span style="display:block;height:8px;width:${total}%;background:${scoreColor(total)};border-radius:4px"></span></span></td>
        </tr>`;
    })
    .join('');

  const rubricItems = RUBRIC.map(
    (criterion) =>
      `<li><strong>${escapeHtml(criterion.label)} (hasta ${criterion.max} puntos)</strong>: ${escapeHtml(criterion.detail)}</li>`,
  ).join('');

  const sections = ranked
    .map((entry) => {
      const total = sourceTotal(entry);
      const breakdown = RUBRIC.map(
        (criterion) =>
          `<tr><td>${escapeHtml(criterion.label)}</td><td class="num">${entry.score[criterion.key]}/${criterion.max}</td></tr>`,
      ).join('');
      const list = (items: string[]) =>
        items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const links = entry.links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}" rel="noopener noreferrer">${escapeHtml(link.label)}</a></li>`,
        )
        .join('');
      return `
    <section id="fuente-${entry.id}" class="fuente">
      <h2>${escapeHtml(entry.ccaa)}
        <span class="fuente-score" style="background:${scoreColor(total)}">${total}/100</span>
      </h2>
      <p><strong>${escapeHtml(entry.registro)}</strong> · Ciudades en el mapa: ${escapeHtml(entry.cities)}.</p>
      <h3>De dónde salen los datos</h3>
      <ul>${links}</ul>
      <h3>Qué datos sirve la fuente</h3>
      <ul>${list(entry.datos)}</ul>
      <h3>Cómo posicionamos cada vivienda</h3>
      <p>${escapeHtml(entry.posicionamiento)}</p>
      <h3>Problemas que hemos encontrado</h3>
      <ul>${list(entry.problemas)}</ul>
      <h3>Qué podría mejorar la administración</h3>
      <ul>${list(entry.mejoras)}</ul>
      <p class="fuente-meta"><strong>Frecuencia:</strong> ${escapeHtml(entry.frecuencia)}<br>
      <strong>Licencia:</strong> ${escapeHtml(entry.licencia)}</p>
      <details>
        <summary>Desglose de la puntuación</summary>
        <table>${breakdown}</table>
      </details>
    </section>`;
    })
    .join('');

  const body = `
    <h1>Fuentes de datos, comunidad a comunidad</h1>
    <p>
      Todo lo que este mapa muestra como «registro oficial» procede de los registros de turismo
      autonómicos, sincronizados semanalmente. Esta página documenta cada fuente en un único
      lugar: de dónde descargamos, qué campos publica cada administración, cómo convertimos sus
      datos en puntos sobre el mapa, con qué problemas hemos topado y qué podría mejorar. Si una
      fuente cambia, esta página se actualiza con ella. <em>Última revisión: ${LAST_REVIEW}.</em>
    </p>

    <h2>Ranking de transparencia de datos</h2>
    <p>
      Puntuamos cada comunidad de 0 a 100 con una rúbrica común — mide la calidad del dato
      publicado y su refresco, no la política turística de nadie:
    </p>
    <ul>${rubricItems}</ul>
    <table>
      <thead><tr><th>#</th><th>Comunidad</th><th class="num">Puntuación</th><th style="width:38%"></th></tr></thead>
      <tbody>${rankingRows}</tbody>
    </table>
    <p class="fuente-meta">
      La puntuación premia a quien publica coordenadas o referencia catastral, identificadores
      registrales estables, plazas, refresco frecuente y licencia abierta clara — todo lo que
      permite reutilizar el dato público sin fricción.
    </p>

    ${sections}

    <div class="note">
      ¿Trabajas en una de estas administraciones y quieres mejorar vuestra puntuación — o hemos
      cometido un error? Escríbenos desde el formulario de contacto del <a href="/">mapa</a>
      (icono del sobre). Ninguna administración citada respalda este proyecto; la crítica y el
      crédito son nuestros.
    </div>`;

  return pageShell({
    title: 'Fuentes de datos por comunidad — Viviendas Perdidas',
    description:
      'De dónde salen los datos oficiales del mapa: fuentes, campos, problemas y un ranking de transparencia de los registros de turismo autonómicos.',
    canonicalPath: '/fuentes',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Fuentes de datos por comunidad — Viviendas Perdidas',
      inLanguage: 'es',
      isAccessibleForFree: true,
    },
    body,
  });
}
