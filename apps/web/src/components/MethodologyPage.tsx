import {
  ArrowLeft,
  Calculator,
  ExternalLink,
  HeartHandshake,
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
