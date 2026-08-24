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
            fuentes. El Censo 2021 es el censo de viviendas más reciente publicado por el INE: el
            Censo Anual solo actualiza población, y los censos de viviendas se publican cada tres o
            cuatro años, así que es el último dato municipal oficial disponible; lo actualizaremos
            en cuanto el INE publique el siguiente.
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
            <strong>vecinales</strong> que aporta la ciudadanía y los registros públicos de
            viviendas de uso turístico (<strong>oficial</strong>). Puedes ver cada fuente por
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
            Los datos oficiales de <strong>Andalucía</strong> proceden de{' '}
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
            Los datos oficiales de <strong>Barcelona</strong> proceden del{' '}
            <strong>«Registro de Turismo de Cataluña»</strong> de la{' '}
            <strong>Generalitat de Catalunya</strong> (Departament d&rsquo;Empresa i Treball),
            publicado en el portal de datos abiertos de la Generalitat bajo la{' '}
            <a
              className="text-link"
              href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies"
              target="_blank"
              rel="noopener noreferrer"
            >
              Licencia abierta de uso de información – Cataluña <ExternalLink size={15} />
            </a>
            , completado con las coordenadas y plazas del conjunto «Viviendas de uso turístico de la
            ciudad de Barcelona» del <strong>Ajuntament de Barcelona</strong> (Open Data BCN, CC BY
            4.0), cruzando ambos por número de registro.
          </p>
          <p>
            Los datos oficiales de la <strong>Comunidad Valenciana</strong> proceden del{' '}
            <strong>«Registro de Turismo de la Comunidad Valenciana»</strong> (lista diaria de
            viviendas de uso turístico) de la <strong>Generalitat Valenciana</strong>, publicado en
            su portal de datos abiertos bajo licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0 <ExternalLink size={15} />
            </a>
            . Ese registro no publica coordenadas pero sí la referencia catastral de cada vivienda:
            las ubicamos consultando la{' '}
            <a
              className="text-link"
              href="https://www.sedecatastro.gob.es/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sede Electrónica del Catastro <ExternalLink size={15} />
            </a>{' '}
            (Dirección General del Catastro), que devuelve el centro de la parcela.
          </p>
          <p>
            Los datos oficiales de <strong>Mallorca</strong> proceden del{' '}
            <strong>
              «Registro de Viviendas Turísticas y Estancias Turísticas en Vivienda de Mallorca»
            </strong>{' '}
            del <strong>Consell de Mallorca</strong>, publicado en el portal de datos abiertos del
            Gobierno de las Islas Baleares bajo licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY <ExternalLink size={15} />
            </a>
            . Se excluyen las figuras de comercializadores y empresarios (operadores, no viviendas);
            la mitad de los registros trae coordenadas y el resto se geocodifica por dirección.
          </p>
          <p>
            Los datos oficiales de <strong>Navarra</strong> proceden del conjunto{' '}
            <strong>«Alojamientos inscritos en el Registro de Turismo de Navarra»</strong> del{' '}
            <strong>Gobierno de Navarra</strong>, publicado en su portal de datos abiertos bajo
            licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0 <ExternalLink size={15} />
            </a>
            . Se filtran las modalidades de apartamento turístico y vivienda turística (hoteles,
            pensiones y alojamientos rurales quedan fuera) y se geocodifican por dirección, porque
            el registro no publica coordenadas.
          </p>
          <p>
            Los datos oficiales de <strong>Euskadi</strong> proceden del conjunto{' '}
            <strong>
              «Viviendas y habitaciones de vivienda particular para uso turístico en Euskadi»
            </strong>{' '}
            (Registro de Empresas y Actividades Turísticas, REATE) del{' '}
            <strong>Gobierno Vasco</strong>, publicado en Open Data Euskadi bajo licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0 <ExternalLink size={15} />
            </a>
            . Distingue viviendas completas de habitaciones en vivienda particular (estas últimas
            suman habitantes, nunca hogares) y se geocodifica por dirección, con el geocodificador
            público CartoCiudad (IGN) como primera vía.
          </p>
          <p>
            Los datos oficiales de <strong>Madrid</strong> proceden del conjunto{' '}
            <strong>«Declaraciones responsables de actividad de viviendas de uso turístico»</strong>{' '}
            de la <strong>Comunidad de Madrid</strong>, publicado en su portal de datos abiertos
            bajo licencia{' '}
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0 <ExternalLink size={15} />
            </a>
            . El conjunto es una instantánea del listado vigente de declaraciones (se refresca
            aproximadamente cada mes: las altas aparecen y las bajas desaparecen), sin número de
            registro ni plazas; cada vivienda se identifica por su dirección normalizada y se ubica
            con CartoCiudad (IGN) a nivel de portal.
          </p>
          <p>
            <strong>Modificaciones que aplicamos</strong> (las licencias obligan a indicarlas): se
            filtran a viviendas de uso turístico y llars compartides publicadas en cada registro
            abierto, se reproyectan las coordenadas andaluzas de UTM (ETRS89 / UTM 30N, EPSG:25830)
            a latitud/longitud (WGS84), se asignan coordenadas a los registros barceloneses
            cruzándolos con el dataset municipal y a los valencianos resolviendo su referencia
            catastral en el Catastro, se calculan estadísticas agregadas por municipio y se agrupan
            las viviendas en celdas geográficas (geohash) para dibujarlas y contarlas según el nivel
            de zoom. Las coordenadas de origen manifiestamente erróneas (algunas fichas vienen
            tecleadas a cientos de km de su municipio) se descartan y se recolocan geocodificando la
            dirección publicada. Solo se refleja el subconjunto de municipios dados de alta en el
            mapa (la lista completa, con su fuente y estado, está en la página de{' '}
            <a className="text-link" href="/fuentes">
              fuentes
            </a>
            ); el pequeño porcentaje de registros que no puede ubicarse con precisión de calle no se
            dibuja ni se cuenta en el mapa. Los edificios de apartamentos turísticos cuentan por sus
            viviendas, no como una: con el dato exacto donde el registro publica las unidades
            (Andalucía, Extremadura) o inscribe cada apartamento por separado (Región de Murcia), y
            estimando el número de apartamentos con un ratio de ~3,5 plazas por apartamento donde
            solo se publica la capacidad (Cataluña, Castilla y León, Galicia, Navarra, Avilés).
          </p>
          <p>
            Los datos oficiales de <strong>Canarias</strong> proceden del{' '}
            <strong>Registro General Turístico de Canarias</strong> (viviendas vacacionales) del{' '}
            <strong>Gobierno de Canarias</strong>, publicado en datos.canarias.es con refresco
            diario y reutilizable con atribución. Unos dos tercios de las fichas traen coordenadas,
            que usamos directamente validándolas contra el término municipal; el tercio restante
            llega con el punto (0,0) de relleno y se geocodifica por dirección en pasadas sucesivas.
          </p>
          <p>
            Los datos oficiales de la <strong>Región de Murcia</strong> proceden de los listados
            públicos de viviendas vacacionales y de apartamentos turísticos del{' '}
            <strong>Instituto de Turismo de la Región de Murcia (ITREM)</strong> (reutilización de
            información del sector público, Ley 37/2007). Publican plazas y, en la mayoría de altas,
            referencia catastral: las ubicamos resolviéndola en la Sede Electrónica del Catastro y
            geocodificando el resto. Los apartamentos turísticos se inscriben apartamento a
            apartamento, así que los edificios completos cuentan por sus viviendas reales; el
            teléfono y el email del titular que publica el listado se descartan en la ingesta.
          </p>
          <p>
            Los datos oficiales de <strong>Menorca</strong> proceden del registro de estancias y
            viviendas turísticas de vacaciones del <strong>Consell Insular de Menorca</strong>{' '}
            (Dades Obertes GOIB, CC BY). El 100% de las fichas trae coordenadas, que usamos
            directamente validándolas contra el término municipal; el teléfono del titular se
            descarta en la ingesta.
          </p>
          <p>
            Los datos oficiales de <strong>Galicia</strong> proceden del directorio de alojamientos
            del REAT de la <strong>Xunta de Galicia</strong> (CC BY-SA 4.0). Se filtran las
            viviendas de uso turístico, las viviendas turísticas y los complejos de apartamentos; el
            directorio apenas trae coordenadas, así que se geocodifica por dirección (con
            CartoCiudad como primera vía) en pasadas sucesivas, y el teléfono y el correo del
            anuncio se descartan.
          </p>
          <p>
            Los datos oficiales de <strong>Castilla y León</strong> proceden del Registro de Turismo
            de la <strong>Junta de Castilla y León</strong> (CC BY 4.0). Se filtran las figuras
            «Vivienda turística» y «Apartamentos Turísticos»; el GPS que publica el registro (~28%
            de filas) se usa validado contra el municipio, el resto se geocodifica, y los datos de
            contacto del titular se descartan.
          </p>
          <p>
            Los datos oficiales de <strong>Aragón</strong> proceden del export del buscador público
            de viviendas de uso turístico del <strong>Gobierno de Aragón</strong> (reutilización de
            información del sector público, Ley 37/2007). No publica plazas ni coordenadas: la
            ubicación se geocodifica por dirección y la capacidad no puede mostrarse; el contacto
            personal que aparece en parte de las filas se descarta.
          </p>
          <p>
            Los datos oficiales de <strong>Castilla-La Mancha</strong> proceden del conjunto de
            apartamentos turísticos y viviendas de uso turístico de la{' '}
            <strong>Junta de Comunidades de Castilla-La Mancha</strong> (CC BY-SA). El conjunto no
            publica número de registro, así que derivamos una clave sintética estable; el refresco
            es semestral y el email y el teléfono del titular se descartan en la ingesta.
          </p>
          <p>
            Los datos oficiales de <strong>Extremadura</strong> proceden del listado de apartamentos
            turísticos de la <strong>Junta de Extremadura</strong> (CC BY 4.0), estancado desde
            marzo de 2025. Cada apartamento turístico declara sus unidades de alojamiento, así que
            los edificios completos cuentan por sus apartamentos reales, no como una sola vivienda.
          </p>
          <p>
            Los datos oficiales de <strong>Ibiza</strong> proceden del Portal de Registres Turístics
            del <strong>Consell Insular d&rsquo;Eivissa</strong> (reutilización de información del
            sector público, Ley 37/2007), un export que se genera en vivo desde la base del registro
            insular. Las cuatro figuras de vivienda (estancias y viviendas turísticas) ceden la
            vivienda completa; casi todas las fichas traen referencia catastral, que resolvemos en
            la Sede Electrónica del Catastro, y el titular (con su NIF), el teléfono y el email se
            descartan en la ingesta.
          </p>
          <p>
            Los datos oficiales de <strong>Cantabria</strong> proceden de la capa «Viviendas
            Turísticas» del servicio cartográfico oficial de la{' '}
            <strong>Dirección General de Turismo del Gobierno de Cantabria</strong> (Licencia de Uso
            No Comercial, Decreto 87/2013). Publica coordenadas nativas, plazas y modalidad
            separable (el alquiler compartido suma habitantes, no hogares), pero no el número de
            registro: derivamos una clave sintética de la dirección, y el teléfono, el email y la
            web del titular se descartan.
          </p>
          <p>
            Los datos oficiales de <strong>La Rioja</strong> proceden del «Listado de Viviendas
            autorizadas» del Registro de Proveedores de Servicios Turísticos del{' '}
            <strong>Gobierno de La Rioja</strong> (reutilización, Ley 37/2007 y Decreto 19/2013
            riojano), un PDF mensual con número de registro estable y dirección que reconstruimos
            posicionalmente y geocodificamos con CartoCiudad (IGN); la fuente no publica plazas ni
            coordenadas.
          </p>
          <p>
            Los datos oficiales de <strong>Gijón</strong> proceden del visor municipal de viviendas
            de uso turístico con licencia del <strong>Ayuntamiento de Gijón</strong> (reutilización,
            Ley 37/2007): expediente único, coordenadas y referencia catastral en prácticamente
            todas las fichas, sin plazas. El Principado de Asturias no publica su registro de
            turismo (REAT) en formato reutilizable; por eso Asturias entra en el mapa por sus
            fuentes municipales.
          </p>
          <p>
            Los datos oficiales de <strong>Avilés</strong> proceden del dataset «Alojamientos
            turísticos» del <strong>Ayuntamiento de Avilés</strong> (CC BY), un extracto municipal
            del REAT con signatura oficial, plazas y referencia catastral, que resolvemos en el
            Catastro. Los bloques de apartamentos turísticos cuentan por sus apartamentos estimados
            por capacidad y el titular se descarta en la ingesta.
          </p>
          <p>
            Los <strong>límites de barrio</strong> que usa el mapa son los polígonos oficiales de
            cada ciudad: Ayuntamiento de Barcelona, Ayuntamiento de Madrid, Ayuntamiento de
            Valencia, Ayuntamiento de Sevilla y Ayuntamiento de Málaga; Ayuntamiento de San
            Sebastián (CC BY-SA 3.0), Ayuntamiento de Pamplona (CC BY 4.0), IDE Palma (Ajuntament de
            Palma), barrios estadísticos de EUSTAT vía geoEuskadi para Bilbao (CC BY), y la capa de
            barrios urbanos de los Datos Espaciales de Referencia de Andalucía (DERA) del{' '}
            <strong>Instituto de Estadística y Cartografía de Andalucía</strong> (CC BY 4.0) para
            Granada, Córdoba, Cádiz, Huelva, Jaén, Almería, Jerez y Marbella.
          </p>
          <p>
            <strong>
              Ninguna administración citada (Junta de Andalucía, Generalitat de Catalunya,
              Ajuntament de Barcelona, Generalitat Valenciana, Dirección General del Catastro,
              Consell de Mallorca, Gobierno de Navarra, Gobierno Vasco, Comunidad de Madrid,
              Gobierno de Canarias, IGN, EUSTAT, IECA ni los ayuntamientos que publican sus barrios)
              respalda o avala este proyecto
            </strong>
            : la cita es un crédito neutral de las fuentes y no implica relación ni aprobación
            alguna. Los datos oficiales se ofrecen «tal cual», sin garantías, y se sincronizan
            semanalmente con cada registro.
          </p>
          <a
            className="text-link"
            href="https://datos.gob.es/es/catalogo/a01002820-openrta"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver el conjunto de datos OpenRTA en datos.gob.es <ExternalLink size={15} />
          </a>{' '}
          <a
            className="text-link"
            href="https://analisi.transparenciacatalunya.cat/d/t2h3-cgys"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver el Registro de Turismo de Cataluña <ExternalLink size={15} />
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
