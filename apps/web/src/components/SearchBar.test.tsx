import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar without a Google key', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hides bundled shortcuts and shows the guidance hint when Maps search is enabled', () => {
    render(<SearchBar mapsEnabled onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByText(/Puedes buscar por ciudad/i)).toBeTruthy();
  });

  it('offers and selects Ruzafa from the bundled fallback', () => {
    const onSelect = vi.fn();
    render(<SearchBar mapsEnabled={false} onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Ruzafa' } });
    fireEvent.click(within(screen.getByRole('option')).getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: 'valencia', source: 'local' }),
    );
  });

  it('uses Places API New and resolves the selected PlacePrediction', async () => {
    const onSelect = vi.fn();
    const fetchFields = vi.fn().mockResolvedValue(undefined);
    const selectedPlace = {
      fetchFields,
      location: { lat: () => 37.3891, lng: () => -5.9845 },
      viewport: {
        getNorthEast: () => ({ lat: () => 37.45, lng: () => -5.9 }),
        getSouthWest: () => ({ lat: () => 37.32, lng: () => -6.08 }),
      },
      formattedAddress: 'Sevilla, España',
      types: ['locality', 'political'],
      addressComponents: [
        { longText: 'Sevilla', shortText: 'Sevilla', types: ['locality'] },
        { longText: 'España', shortText: 'ES', types: ['country'] },
      ],
    };
    const prediction = {
      placeId: 'sevilla-place-id',
      mainText: { text: 'Sevilla' },
      secondaryText: { text: 'España' },
      text: { text: 'Sevilla, España' },
      toPlace: () => selectedPlace,
    };
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({
      suggestions: [{ placePrediction: prediction }],
    });
    function AutocompleteSessionTokenMock() {
      return undefined;
    }
    const AutocompleteSuggestionMock = { fetchAutocompleteSuggestions };
    const importLibrary = vi.fn().mockResolvedValue({
      AutocompleteSessionToken: AutocompleteSessionTokenMock,
      AutocompleteSuggestion: AutocompleteSuggestionMock,
    });
    vi.stubGlobal('google', { maps: { importLibrary } });

    render(<SearchBar mapsEnabled onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Sevilla' } });
    const option = await screen.findByRole('option');
    fireEvent.click(within(option).getByRole('button'));

    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          placeId: 'sevilla-place-id',
          cityId: 'sevilla',
          position: { lat: 37.3891, lng: -5.9845 },
          zoom: 12,
        }),
      ),
    );
    expect(fetchAutocompleteSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ includedRegionCodes: ['es'], language: 'es', region: 'es' }),
    );
    expect(fetchFields).toHaveBeenCalledWith(
      expect.objectContaining({ fields: expect.arrayContaining(['location', 'viewport']) }),
    );
  });
});
