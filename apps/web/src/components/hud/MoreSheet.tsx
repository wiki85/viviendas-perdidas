import type { ReactNode } from 'react';
import {
  Building2,
  ChevronRight,
  Coffee,
  ExternalLink,
  FileText,
  Info,
  Landmark,
  Mail,
  MailPlus,
  Newspaper,
  Scale,
  Share2,
} from 'lucide-react';
import { Sheet } from '../Sheet';
import type { CityReportLink } from './ImpactDetails';

type Props = {
  cityReport: CityReportLink | null;
  onOpenAbout: () => void;
  onOpenMethodology: () => void;
  onOpenContact: () => void;
  onOpenDonate: () => void;
  onOpenNewsletter: (cityId?: string) => void;
  onShare: () => void;
  onClose: () => void;
};

function Item({
  icon,
  label,
  hint,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      {icon}
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {href ? (
        <ExternalLink className="menu__ext" size={16} aria-hidden="true" />
      ) : (
        <ChevronRight className="menu__ext" size={16} aria-hidden="true" />
      )}
    </>
  );
  return (
    <li>
      {href ? (
        <a className="menu__item" href={href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <button className="menu__item" type="button" onClick={onClick}>
          {body}
        </button>
      )}
    </li>
  );
}

/** Menú «Más»: el resto de secciones y acciones, agrupadas. */
export function MoreSheet({
  cityReport,
  onOpenAbout,
  onOpenMethodology,
  onOpenContact,
  onOpenDonate,
  onOpenNewsletter,
  onShare,
  onClose,
}: Props) {
  const go = (action: () => void) => () => {
    onClose();
    action();
  };
  return (
    <Sheet variant="menu" labelledBy="more-title" onClose={onClose} closeLabel="Cerrar menú">
      <div className="menu">
        <h2 id="more-title" className="menu__title">
          Más
        </h2>
        <div className="menu__group">
          <p className="menu__heading">Esta zona</p>
          <ul className="menu__list">
            <Item
              icon={<Share2 size={20} aria-hidden="true" />}
              label="Compartir esta zona"
              hint="Enlace con las cifras que ves"
              onClick={go(onShare)}
            />
            {cityReport && (
              <Item
                icon={<FileText size={20} aria-hidden="true" />}
                label={`Informe de ${cityReport.name}`}
                hint="Impacto en comercio, aulas y vivienda"
                href={`/ciudad/${encodeURIComponent(cityReport.id)}`}
              />
            )}
            <Item
              icon={<MailPlus size={20} aria-hidden="true" />}
              label={cityReport ? `Suscríbete a ${cityReport.name}` : 'El Recuento, el boletín'}
              hint="Avisos cuando cambien las cifras"
              onClick={go(() => onOpenNewsletter(cityReport?.id))}
            />
          </ul>
        </div>
        <div className="menu__group">
          <p className="menu__heading">El proyecto</p>
          <ul className="menu__list">
            <Item
              icon={<Info size={20} aria-hidden="true" />}
              label="Acerca del proyecto"
              onClick={go(onOpenAbout)}
            />
            <Item
              icon={<Scale size={20} aria-hidden="true" />}
              label="Metodología y transparencia"
              onClick={go(onOpenMethodology)}
            />
            <Item
              icon={<Landmark size={20} aria-hidden="true" />}
              label="Fuentes oficiales"
              href="/fuentes"
            />
            <Item
              icon={<Building2 size={20} aria-hidden="true" />}
              label="Ciudad a ciudad"
              href="/ciudades"
            />
            <Item icon={<Newspaper size={20} aria-hidden="true" />} label="Prensa" href="/prensa" />
          </ul>
        </div>
        <div className="menu__group">
          <p className="menu__heading">Participa</p>
          <ul className="menu__list">
            <Item
              icon={<Mail size={20} aria-hidden="true" />}
              label="Contacto"
              onClick={go(onOpenContact)}
            />
            <Item
              icon={<Coffee size={20} aria-hidden="true" />}
              label="Invítanos a un café"
              hint="Apoya los costes del mapa"
              onClick={go(onOpenDonate)}
            />
          </ul>
        </div>
        <p className="menu__footer">
          Proyecto vecinal, independiente y sin ánimo de lucro. Sin cuentas ni rastreo.
        </p>
      </div>
    </Sheet>
  );
}
