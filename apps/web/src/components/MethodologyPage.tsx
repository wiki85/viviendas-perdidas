import {
  ArrowLeft,
  Calculator,
  ExternalLink,
  HeartHandshake,
  Landmark,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { HOUSEHOLD_SIZE } from '../lib/constants';
import { BrandMark } from './BrandMark';

type Props = {
  onClose: () => void;
};

export function MethodologyPage({ onClose }: Props) {
  return (
    <main className="about-page">
      <nav className="about-page__nav">
        <button className="button button--ghost" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al mapa
        </button>
        <BrandMark />
      </nav>
      <article className="about-page__article">
        <p className="eyebrow">Metodología y transparencia</p>
        <h1>Cómo calculamos los números y por qué puedes fiarte de nuestras intenciones.</h1>

        <section className="about-page__section">
          <h2>
            <Calculator size={20} aria-hidden="true" /> Cómo estimamos las personas por vivienda
          </h2>
          <p>
            Cada vivienda registrada representa un hogar que ya no puede vivir ahí. Para traducir
            hogares a personas usamos el <strong>tamaño medio del hogar en España</strong> que
            publica el Instituto Nacional de Estadística en su Encuesta Continua de Hogares:{' '}
            <strong>{HOUSEHOLD_SIZE.toLocaleString('es-ES')} personas por hogar</strong> (dato de
            referencia de 2023, redondeado a una cifra manejable).
          </p>
          <p>El cálculo completo es deliberadamente simple y auditable:</p>
          <ol>
            <li>
              <strong>Viviendas perdidas</strong> = número de viviendas declaradas en cada registro
              (un apartamento cuenta 1; un edificio, las que declare, entre 1 y 500).
            </li>
            <li>
              <strong>Familias desplazadas</strong> = viviendas perdidas (asumimos un hogar por
              vivienda).
            </li>
            <li>
              <strong>Habitantes estimados</strong> = viviendas ×{' '}
              {HOUSEHOLD_SIZE.toLocaleString('es-ES')}, redondeado al entero más próximo.
            </li>
            <li>
              <strong>Locales perdidos</strong>: los bajos comerciales convertidos en alojamiento
              turístico se cuentan aparte. No suman viviendas ni habitantes, porque nadie residía en
              ellos: reflejan la pérdida de comercio de proximidad del barrio.
            </li>
          </ol>
          <p>
            Es una estimación, no un censo: el tamaño real de cada hogar varía según la ciudad, el
            barrio y el tipo de vivienda. Preferimos una cifra prudente y explicable a un modelo
            opaco.
          </p>
          <p>
            Las <strong>páginas de ciudad</strong> traducen además esos hogares a impactos
            concretos, siempre con estadística pública: el{' '}
            <strong>consumo anual que pierde el barrio</strong> multiplica los hogares desplazados
            por el gasto medio por hogar de la Encuesta de Presupuestos Familiares 2024 del INE
            (34.044 €, de los que el 15,8% es alimentación); los{' '}
            <strong>menores que dejan de vivir</strong> en esas casas aplican el 13,8% de población
            menor de 15 años (INE) y se expresan en aulas de 21 alumnos (media estatal, Ministerio
            de Educación); y la <strong>presión sobre la vivienda</strong> compara las viviendas
            turísticas oficiales con los hogares principales del Censo 2021 (IECA/SIMA), citando la
            evidencia académica de García-López et al. (<em>Journal of Urban Economics</em>, 2020)
            sobre el efecto del alquiler turístico en alquileres y precios. Cada página enlaza sus
            fuentes.
          </p>
          <a
            className="text-link"
            href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176952&menu=ultiDatos&idp=1254735572981"
            target="_blank"
            rel="noreferrer"
          >
            Encuesta Continua de Hogares (INE) <ExternalLink size={15} />
          </a>
        </section>

        <section className="about-page__section">
          <h2>
            <Scale size={20} aria-hidden="true" /> Un proyecto meramente informativo
          </h2>
          <p>
            Este mapa se construye con aportaciones voluntarias de vecinas y vecinos, y por tanto{' '}
            <strong>puede contener errores u omisiones</strong>. No es un registro oficial, no
            sustituye a ningún censo ni inventario administrativo y sus cifras no deben usarse como
            prueba en procedimientos legales. Señalar un inmueble no acusa a ninguna persona: marca
            un edificio para que la comunidad lo revise.
          </p>
        </section>

        <section className="about-page__section">
          <h2>
            <ShieldCheck size={20} aria-hidden="true" /> No almacenamos información personal
          </h2>
          <p>
            La aplicación funciona <strong>sin cuentas de usuario</strong>. No pedimos ni guardamos
            nombres, correos, teléfonos ni direcciones IP. Un identificador aleatorio vive
            únicamente en tu navegador y solo sale de él convertido en un hash irreversible, para
            evitar votos duplicados. Las notas que incluyen teléfonos, correos o enlaces se rechazan
            automáticamente, y las fotos pasan por una revisión humana previa; además, al
            prepararlas se eliminan sus metadatos (como la ubicación GPS de tu cámara).
          </p>
          <p>
            Para entender cuánta gente visita el mapa usamos{' '}
            <strong>Cloudflare Web Analytics</strong>, una medición de audiencia agregada que
            funciona <strong>sin cookies y sin identificadores</strong>: cuenta visitas y páginas
            vistas, pero no crea perfiles ni rastrea a nadie entre sitios.
          </p>
        </section>

        <section className="about-page__section">
          <h2>
            <Landmark size={20} aria-hidden="true" /> Fuentes de datos y licencia
          </h2>
          <p>
            El mapa maneja dos fuentes <strong>siempre identificables</strong>: los registros{' '}
            <strong>vecinales</strong> que aporta la ciudadanía y el registro público de viviendas
            de uso turístico de Andalucía (<strong>oficial</strong>). Puedes ver cada fuente por
            separado o ambas a la vez; en el modo «Ambas» los contadores suman las dos y una franja
            indica cuánto aporta el registro oficial. Los contadores reflejan siempre{' '}
            <strong>la zona visible del mapa</strong>: al buscar una ciudad, un barrio o un código
            postal se cuentan los registros de esa zona, y al desplazarte se actualizan con lo que
            tengas a la vista. Las viviendas oficiales «por habitaciones» no cuentan como hogar
            desplazado (el titular puede seguir residiendo), pero sí suman habitantes: cada
            habitación alquilada a turistas deja de alquilarse a un residente de larga duración, así
            que estimamos <strong>un habitante desplazado por habitación</strong>, con habitaciones
            ≈ plazas ÷ 2 (mínimo 1 por vivienda).
          </p>
          <p>
            Los datos oficiales proceden de{' '}
            <strong>«OpenRTA — Registro de Turismo de Andalucía»</strong> de la{' '}
            <strong>Junta de Andalucía</strong> (Registro de Turismo de Andalucía, RTA), publicados
            en su portal de datos abiertos y catalogados en datos.gob.es. Se distribuyen bajo la
            licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Creative Commons Reconocimiento 4.0 Internacional (CC BY 4.0){' '}
              <ExternalLink size={15} />
            </a>
            .
          </p>
          <p>
            <strong>Modificaciones que aplicamos</strong> (la licencia obliga a indicarlas): se
            filtran a viviendas de uso turístico publicadas en el RTA abierto, se reproyectan las
            coordenadas de UTM (ETRS89 / UTM 30N, EPSG:25830) a latitud/longitud (WGS84), se
            calculan estadísticas agregadas por municipio y se agrupan las viviendas en celdas
            geográficas (geohash) para dibujarlas y contarlas según el nivel de zoom. Las
            coordenadas de origen manifiestamente erróneas (algunas fichas del RTA vienen tecleadas
            a cientos de km de su municipio) se descartan y se recolocan geocodificando la dirección
            publicada. Solo se refleja un subconjunto de municipios andaluces; el pequeño porcentaje
            de registros que no puede ubicarse con precisión de calle no se dibuja ni se cuenta en
            el mapa.
          </p>
          <p>
            <strong>La Junta de Andalucía no respalda ni avala este proyecto</strong>: la cita es un
            crédito neutral de la fuente y no implica relación ni aprobación alguna. Los datos
            oficiales se ofrecen «tal cual», sin garantías.
          </p>
          <a
            className="text-link"
            href="https://datos.gob.es/es/catalogo/a01002820-openrta"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver el conjunto de datos OpenRTA en datos.gob.es <ExternalLink size={15} />
          </a>
        </section>

        <section className="about-page__section">
          <h2>
            <HeartHandshake size={20} aria-hidden="true" /> Independencia
          </h2>
          <p>
            Este es un <strong>proyecto independiente y sin ánimo de lucro</strong>. No pertenece a
            ningún partido, empresa, plataforma ni administración, no muestra publicidad y no
            comercia con datos. Su único objetivo es <strong>concienciar</strong> sobre el impacto
            que la conversión de viviendas y locales en alojamientos turísticos tiene en los barrios
            de las grandes ciudades: menos vecinos, menos comercio de proximidad y barrios que se
            vacían de vida cotidiana.
          </p>
        </section>
      </article>
    </main>
  );
}
