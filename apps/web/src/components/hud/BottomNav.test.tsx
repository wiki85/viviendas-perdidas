import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';

const handlers = () => ({
  onMap: vi.fn(),
  onStats: vi.fn(),
  onRegister: vi.fn(),
  onNewsletter: vi.fn(),
  onMore: vi.fn(),
});

describe('BottomNav', () => {
  it('marca la sección activa y expone «Registrar» como acción primaria', () => {
    const props = handlers();
    render(<BottomNav section="stats" moreOpen={false} {...props} />);
    const nav = screen.getByRole('navigation', { name: /secciones principales/i });
    expect(within(nav).getByRole('button', { name: /cifras/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('button', { name: /^mapa$/i })).not.toHaveAttribute(
      'aria-current',
    );
    fireEvent.click(within(nav).getByRole('button', { name: /registrar un inmueble/i }));
    expect(props.onRegister).toHaveBeenCalledTimes(1);
    fireEvent.click(within(nav).getByRole('button', { name: /boletín/i }));
    expect(props.onNewsletter).toHaveBeenCalledTimes(1);
  });

  it('anuncia el estado del menú «Más» y lo resalta en sus secciones', () => {
    const props = handlers();
    render(<BottomNav section="about" moreOpen {...props} />);
    const more = screen.getByRole('button', { name: /^más$/i });
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveAttribute('aria-current', 'page');
    fireEvent.click(more);
    expect(props.onMore).toHaveBeenCalledTimes(1);
  });
});
