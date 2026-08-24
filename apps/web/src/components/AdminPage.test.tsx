import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ListingsService } from '../domain/types';
import { AuthFlowError } from '../lib/auth-errors';
import { AdminPage } from './AdminPage';

function makeService(overrides: Record<string, unknown> = {}): ListingsService {
  return {
    prepareAuth: vi.fn().mockResolvedValue({ kind: 'none' }),
    adminSignIn: vi
      .fn()
      .mockResolvedValue({ status: 'ok', email: 'moderadora@example.com', moderator: true }),
    listPendingPhotos: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ListingsService;
}

async function waitForGateButton() {
  return await screen.findByRole('button', { name: /entrar con google/i });
}

describe('AdminPage', () => {
  it('rehidrata la sesión de moderación al recargar, sin popup', async () => {
    const service = makeService({
      prepareAuth: vi.fn().mockResolvedValue({ kind: 'session', email: 'moderadora@example.com' }),
    });
    render(<AdminPage service={service} onClose={vi.fn()} />);

    await screen.findByRole('tablist');
    // adminSignIn resuelve desde la sesión persistida (probe incluido).
    expect(service.adminSignIn).toHaveBeenCalled();
  });

  it('muestra la pantalla de cuenta sin permisos', async () => {
    const service = makeService({
      adminSignIn: vi
        .fn()
        .mockResolvedValue({ status: 'ok', email: 'intrusa@example.com', moderator: false }),
    });
    render(<AdminPage service={service} onClose={vi.fn()} />);

    fireEvent.click(await waitForGateButton());
    await screen.findByText(/no tiene permisos/i);
    expect(screen.getByText(/intrusa@example\.com/)).toBeInTheDocument();
  });

  it('no muestra error si la moderadora cancela el popup', async () => {
    const service = makeService({
      adminSignIn: vi.fn().mockResolvedValue({ status: 'cancelled' }),
    });
    render(<AdminPage service={service} onClose={vi.fn()} />);

    fireEvent.click(await waitForGateButton());
    await waitFor(() => expect(service.adminSignIn).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /entrar con google/i })).toBeEnabled();
  });

  it('muestra el mensaje del AuthFlowError cuando el login falla', async () => {
    const service = makeService({
      adminSignIn: vi
        .fn()
        .mockRejectedValue(new AuthFlowError('auth/too-many-requests', 'Demasiados intentos.')),
    });
    render(<AdminPage service={service} onClose={vi.fn()} />);

    fireEvent.click(await waitForGateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos.');
  });
});
