import { ChartLine, Mail, Map, Menu, Plus } from 'lucide-react';

export type Section = 'map' | 'stats' | 'newsletter' | 'about' | 'methodology' | 'contact';

type Props = {
  section: Section;
  moreOpen: boolean;
  onMap: () => void;
  onStats: () => void;
  onRegister: () => void;
  onNewsletter: () => void;
  onMore: () => void;
};

const MORE_SECTIONS: ReadonlySet<Section> = new Set(['about', 'methodology', 'contact']);

/** Dock flotante con las secciones principales; «Registrar» es la acción primaria. */
export function BottomNav({
  section,
  moreOpen,
  onMap,
  onStats,
  onRegister,
  onNewsletter,
  onMore,
}: Props) {
  const item = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    current: boolean,
    extra: React.ButtonHTMLAttributes<HTMLButtonElement> = {},
  ) => (
    <button
      className="dock__item"
      type="button"
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      {...extra}
    >
      <span className="dock__icon">{icon}</span>
      <span className="dock__label">{label}</span>
    </button>
  );

  return (
    <nav className="dock" aria-label="Secciones principales">
      {item('Mapa', <Map aria-hidden="true" />, onMap, section === 'map')}
      {item('Cifras', <ChartLine aria-hidden="true" />, onStats, section === 'stats')}
      <button
        className="dock__item dock__item--primary"
        type="button"
        onClick={onRegister}
        aria-label="Registrar un inmueble turístico"
      >
        <span className="dock__icon">
          <Plus aria-hidden="true" strokeWidth={2.6} />
        </span>
        <span className="dock__label" aria-hidden="true">
          Registrar
        </span>
      </button>
      {item('Boletín', <Mail aria-hidden="true" />, onNewsletter, section === 'newsletter')}
      {item('Más', <Menu aria-hidden="true" />, onMore, MORE_SECTIONS.has(section), {
        'aria-expanded': moreOpen,
        'aria-haspopup': 'dialog',
      })}
    </nav>
  );
}
