import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RegisterWizard } from './RegisterWizard';

describe('RegisterWizard mobile flow', () => {
  it('submits a 12-home building only after privacy and confirmation checks', async () => {
    const onCreate = vi.fn().mockResolvedValue({
      created: true,
      listing: { id: 'created-listing' },
      warnings: [],
    });
    render(
      <RegisterWizard
        center={{ lat: 39.4623, lng: -0.3734 }}
        pickedPosition={null}
        mapsEnabled={false}
        onPlacementModeChange={vi.fn()}
        onPreviewLocation={vi.fn()}
        onClose={vi.fn()}
        onCreate={onCreate}
        onSelectDuplicate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /usar el centro/i }));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByRole('radio', { name: /edificio completo/i }));
    fireEvent.change(screen.getByLabelText(/número de viviendas en el edificio/i), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    const license = screen.getByLabelText(/número de licencia turística/i);
    fireEvent.change(license, { target: { value: 'Nombre Persona' } });
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    expect(screen.getByText(/la licencia debe contener letras y números/i)).toBeInTheDocument();
    fireEvent.change(license, { target: { value: '' } });

    const note = screen.getByLabelText(/nota breve/i);
    fireEvent.change(note, { target: { value: 'Llama al 612 345 678' } });
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    expect(screen.getByText(/no incluyas teléfonos/i)).toBeInTheDocument();
    fireEvent.change(note, { target: { value: 'Placa turística visible en la entrada.' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    const submit = screen.getByRole('button', { name: /confirmar registro/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/confirmo que la ubicación/i));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'building',
          dwellingsCount: 12,
          location: { lat: 39.4623, lng: -0.3734 },
          evidence: { note: 'Placa turística visible en la entrada.' },
        }),
        null,
      ),
    );
  });

  it('lets the user clear a count field without rewriting a zero (mobile keyboards)', () => {
    render(
      <RegisterWizard
        center={{ lat: 39.4623, lng: -0.3734 }}
        pickedPosition={null}
        mapsEnabled={false}
        onPlacementModeChange={vi.fn()}
        onPreviewLocation={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onSelectDuplicate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /usar el centro/i }));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByRole('radio', { name: /edificio completo/i }));

    const dwellings = screen.getByLabelText<HTMLInputElement>(
      /número de viviendas en el edificio/i,
    );
    // Clearing must leave the field empty (not snap back to "0"/"1")...
    fireEvent.change(dwellings, { target: { value: '' } });
    expect(dwellings.value).toBe('');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    // ...so typing afterwards produces "2", never "02".
    fireEvent.change(dwellings, { target: { value: '2' } });
    expect(dwellings.value).toBe('2');
    // Leading zeros and out-of-range values normalize on blur.
    fireEvent.change(dwellings, { target: { value: '07' } });
    fireEvent.blur(dwellings);
    expect(dwellings.value).toBe('7');
    // The +/− buttons replace the native spinners hidden on mobile.
    // Two count fields render for a building; the first pair is dwellings.
    fireEvent.click(screen.getAllByRole('button', { name: /sumar uno/i })[0]);
    expect(dwellings.value).toBe('8');
  });
});
