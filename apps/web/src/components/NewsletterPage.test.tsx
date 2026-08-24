import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NewsletterPreferences } from '../domain/types';
import { AuthFlowError } from '../lib/auth-errors';
import { NewsletterPage } from './NewsletterPage';

const PREFERENCES: NewsletterPreferences = {
  email: 'vecina@example.com',
  subscribed: false,
  scopes: [],
  weekly: true,
  monthly: true,
};

function makeProps(overrides: Partial<Parameters<typeof NewsletterPage>[0]> = {}) {
  return {
    onClose: vi.fn(),
    prepareAuth: vi.fn().mockResolvedValue({ kind: 'none' as const }),
    signIn: vi.fn().mockResolvedValue({ status: 'ok' as const, email: 'vecina@example.com' }),
    signOut: vi.fn().mockResolvedValue(undefined),
    sendLoginLink: vi.fn().mockResolvedValue(undefined),
    completeEmailLink: vi
      .fn()
      .mockResolvedValue({ status: 'ok' as const, email: 'vecina@example.com' }),
    loadPreferences: vi.fn().mockResolvedValue(PREFERENCES),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function waitForGate() {
  await screen.findByRole('button', { name: /continuar con google/i });
}

describe('NewsletterPage', () => {
  it('rehidrata una sesión persistida sin exigir otro clic', async () => {
    const props = makeProps({
      prepareAuth: vi
        .fn()
        .mockResolvedValue({ kind: 'session' as const, email: 'vecina@example.com' }),
    });
    render(<NewsletterPage {...props} />);

    await screen.findByText(/vecina@example\.com/);
    expect(props.loadPreferences).toHaveBeenCalled();
    expect(props.signIn).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /continuar con google/i })).toBeNull();
  });

  it('no muestra error cuando la vecina cancela el popup', async () => {
    const props = makeProps({
      signIn: vi.fn().mockResolvedValue({ status: 'cancelled' as const }),
    });
    render(<NewsletterPage {...props} />);
    await waitForGate();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));
    await waitFor(() => expect(props.signIn).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('muestra el mensaje del AuthFlowError cuando el login falla de verdad', async () => {
    const props = makeProps({
      signIn: vi
        .fn()
        .mockRejectedValue(new AuthFlowError('auth/network-request-failed', 'No hay conexión.')),
    });
    render(<NewsletterPage {...props} />);
    await waitForGate();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión.');
  });

  it('distingue un fallo al cargar preferencias de un fallo de login', async () => {
    const props = makeProps({
      loadPreferences: vi.fn().mockRejectedValue(new Error('boom')),
    });
    render(<NewsletterPage {...props} />);
    await waitForGate();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudieron cargar tus preferencias/i);
    expect(alert).toHaveTextContent(/vecina@example\.com/);
    // Sigue en la puerta: el mismo botón sirve de reintento sin reabrir popup.
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument();
  });

  it('pre-marca la ciudad del botón «Suscríbete a X» del mapa', async () => {
    const props = makeProps({
      prepareAuth: vi
        .fn()
        .mockResolvedValue({ kind: 'session' as const, email: 'vecina@example.com' }),
    });
    render(<NewsletterPage {...props} preselectCityId="madrid" />);

    await screen.findByText(/vecina@example\.com/);
    expect(screen.getByRole('checkbox', { name: 'Madrid' })).toBeChecked();
  });

  it('cierra la sesión y vuelve a la puerta de entrada', async () => {
    const props = makeProps({
      prepareAuth: vi
        .fn()
        .mockResolvedValue({ kind: 'session' as const, email: 'vecina@example.com' }),
    });
    render(<NewsletterPage {...props} />);
    await screen.findByText(/vecina@example\.com/);

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    await waitForGate();
    expect(props.signOut).toHaveBeenCalled();
  });

  it('envía el enlace mágico y confirma a qué correo', async () => {
    const props = makeProps();
    render(<NewsletterPage {...props} />);
    await waitForGate();

    fireEvent.change(screen.getByLabelText(/correo para recibir un enlace/i), {
      target: { value: 'lector@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviarme un enlace/i }));

    await screen.findByText(/te hemos enviado un enlace/i);
    expect(props.sendLoginLink).toHaveBeenCalledWith('lector@example.com');
    expect(screen.getByText(/lector@example\.com/)).toBeInTheDocument();
  });

  it('rechaza un correo mal escrito sin llamar al servicio', async () => {
    const props = makeProps();
    render(<NewsletterPage {...props} />);
    await waitForGate();

    // «a@b» pasa la validación nativa de type="email" (que no exige punto)
    // pero no la nuestra: exactamente el hueco que cubre el regex propio.
    fireEvent.change(screen.getByLabelText(/correo para recibir un enlace/i), {
      target: { value: 'a@b' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviarme un enlace/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/correo válido/i);
    expect(props.sendLoginLink).not.toHaveBeenCalled();
  });

  it('pide confirmar el correo cuando el enlace se abre en otro dispositivo', async () => {
    const props = makeProps({
      prepareAuth: vi.fn().mockResolvedValue({ kind: 'emailLinkPendingEmail' as const }),
    });
    render(<NewsletterPage {...props} />);

    await screen.findByText(/confirma el correo/i);
    fireEvent.change(screen.getByLabelText(/correo con el que pediste el enlace/i), {
      target: { value: 'vecina@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar correo/i }));

    await screen.findByText(/vecina@example\.com/);
    expect(props.completeEmailLink).toHaveBeenCalledWith('vecina@example.com');
    expect(props.loadPreferences).toHaveBeenCalled();
  });
});
