import { ArrowLeft, Download, ExternalLink, HeartHandshake, ShieldCheck } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { HOUSEHOLD_SIZE } from '../lib/constants';

type Props = {
  onClose: () => void;
  onExport: () => Promise<void>;
  onOpenMethodology: () => void;
};

export function AboutPage({ onClose, onExport, onOpenMethodology }: Props) {
  return (
    <main className="about-page">
      <nav className="about-page__nav">
        <button className="button button--ghost" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al mapa
        </button>
        <BrandMark />
      </nav>
      <article className="about-page__article">
        <p className="eyebrow">Metodología abierta</p>
        <h1>Lo que desaparece de un barrio también merece verse.</h1>
        <p className="about-page__lead">
          Viviendas Perdidas es un mapa colaborativo y no oficial. Hace visible el impacto
          residencial estimado de los apartamentos turísticos, sin recopilar datos personales de
          quienes colaboran.
        </p>
        <div className="about-page__cards">
          <section>
            <HeartHandshake aria-hidden="true" />
            <h2>Qué contamos</h2>
            <p>
              Cada vivienda turística registrada equivale a una vivienda y una familia menos.
              Estimamos{' '}
              <strong>{HOUSEHOLD_SIZE.toLocaleString('es-ES')} habitantes por hogar</strong>,
              redondeando el resultado.
            </p>
          </section>
          <section>
            <ShieldCheck aria-hidden="true" />
            <h2>Privacidad por diseño</h2>
            <p>
              No guardamos nombres, emails ni teléfonos, y no almacenamos direcciones IP. Un UUID
              aleatorio vive solo en tu navegador y se usa, convertido a hash SHA-256, para evitar
              votos duplicados casuales.
            </p>
          </section>
        </div>
        <section className="about-page__section">
          <h2>Cómo funciona</h2>
          <ol>
            <li>
              <strong>Alguien señala un inmueble</strong> e indica si es una vivienda o un edificio
              completo.
            </li>
            <li>
              <strong>La comunidad valida</strong> el registro o avisa de errores. Los registros
              dudosos pasan a revisión y los retirados dejan de contar.
            </li>
            <li>
              <strong>El mapa agrega</strong> los datos por municipio o barrio, según el nivel de
              zoom.
            </li>
          </ol>
          <p>
            Los datos son colaborativos, pueden contener errores y no sustituyen a ningún registro
            administrativo. La equivalencia usa como referencia el tamaño medio del hogar publicado
            por el INE (2023). Los locales comerciales convertidos en alojamiento turístico se
            cuentan aparte, como locales perdidos para el barrio.
          </p>
          <button className="text-link" type="button" onClick={onOpenMethodology}>
            Leer la metodología completa y el compromiso de transparencia <ExternalLink size={15} />
          </button>
        </section>
        <section className="about-page__section about-page__download">
          <div>
            <h2>Los datos son de todos</h2>
            <p>
              Descarga los registros públicos activos en JSON. La exportación no contiene
              identificadores de voto ni campos internos de moderación.
            </p>
          </div>
          <button className="button button--primary" type="button" onClick={() => void onExport()}>
            <Download size={18} /> Descargar JSON
          </button>
        </section>
        <section className="about-page__section">
          <h2>Política de privacidad</h2>
          <p>
            No hay cuentas, perfiles ni analítica de terceros. Las notas que contienen teléfonos,
            correos o enlaces se rechazan. Google Maps puede tratar información conforme a su propia
            política; por eso lo indicamos antes de usar el mapa.
          </p>
        </section>
      </article>
    </main>
  );
}
