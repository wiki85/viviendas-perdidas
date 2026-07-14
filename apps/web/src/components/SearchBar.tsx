import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import type { MapBounds, SearchPlace } from '../domain/types';
import { municipalityFromPlace } from '../lib/google-geocode';
import { searchLocalPlaces } from '../lib/local-search';

type Props = {
  mapsEnabled: boolean;
  onSelect: (place: SearchPlace) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

function googleBounds(bounds: google.maps.LatLngBounds | null | undefined): MapBounds | undefined {
  if (!bounds) return undefined;
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  return {
    north: northEast.lat(),
    east: northEast.lng(),
    south: southWest.lat(),
    west: southWest.lng(),
  };
}

export function SearchBar({ mapsEnabled, onSelect, placeholder, autoFocus }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [googleSuggestions, setGoogleSuggestions] = useState<SearchPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(() => Boolean(window.google?.maps));
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const predictionById = useRef(new Map<string, google.maps.places.PlacePrediction>());
  const newestRequest = useRef(0);
  // Los accesos directos locales solo sostienen el modo demo sin Google Maps;
  // con la búsqueda online activa el usuario busca cualquier lugar de España.
  const localSuggestions = useMemo(
    () => (mapsEnabled ? [] : searchLocalPlaces(query)),
    [mapsEnabled, query],
  );
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return [...localSuggestions, ...googleSuggestions].filter((place) => {
      const key = `${place.primary}:${place.secondary}`.toLocaleLowerCase('es');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [googleSuggestions, localSuggestions]);

  useEffect(() => {
    const listener = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, []);

  useEffect(() => {
    if (!mapsEnabled) return;
    const handleReady = () => setMapsReady(true);
    window.addEventListener('viviendas-perdidas:maps-ready', handleReady);
    return () => window.removeEventListener('viviendas-perdidas:maps-ready', handleReady);
  }, [mapsEnabled]);

  useEffect(() => {
    if (!mapsEnabled || !mapsReady || query.trim().length < 2 || !window.google?.maps) {
      setGoogleSuggestions([]);
      return;
    }
    const requestId = ++newestRequest.current;
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setSearchError(null);
      void google.maps
        .importLibrary('places')
        .then(async (library) => {
          const { AutocompleteSessionToken, AutocompleteSuggestion } =
            library as google.maps.PlacesLibrary;
          sessionToken.current ??= new AutocompleteSessionToken();
          const { suggestions: onlineSuggestions } =
            await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: query,
              includedRegionCodes: ['es'],
              language: 'es',
              region: 'es',
              sessionToken: sessionToken.current,
            });
          if (!active || requestId !== newestRequest.current) return;
          predictionById.current.clear();
          const predictions = onlineSuggestions.flatMap((suggestion) =>
            suggestion.placePrediction ? [suggestion.placePrediction] : [],
          );
          for (const prediction of predictions) {
            predictionById.current.set(prediction.placeId, prediction);
          }
          setGoogleSuggestions(
            predictions.slice(0, 5).map((prediction) => ({
              id: `google-${prediction.placeId}`,
              placeId: prediction.placeId,
              primary: prediction.mainText?.text ?? prediction.text.text,
              secondary: prediction.secondaryText?.text ?? 'España',
              position: { lat: 0, lng: 0 },
              zoom: 16,
              source: 'google' as const,
            })),
          );
        })
        .catch(() => {
          if (active && requestId === newestRequest.current) {
            setGoogleSuggestions([]);
            setSearchError('La búsqueda no está disponible ahora mismo. Vuelve a intentarlo.');
          }
        })
        .finally(() => {
          if (active && requestId === newestRequest.current) setLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [mapsEnabled, mapsReady, query]);

  const select = (place: SearchPlace) => {
    setQuery(place.primary);
    setOpen(false);
    setActiveIndex(-1);
    if (place.source === 'local' || !place.placeId || !window.google?.maps) {
      sessionToken.current = null;
      onSelect(place);
      return;
    }
    setLoading(true);
    setSearchError(null);
    const prediction = predictionById.current.get(place.placeId);
    if (!prediction) {
      setLoading(false);
      setSearchError('Ese resultado ha caducado. Vuelve a buscarlo.');
      return;
    }
    const selectedPlace = prediction.toPlace();
    void selectedPlace
      .fetchFields({
        fields: ['location', 'viewport', 'formattedAddress', 'types', 'addressComponents'],
      })
      .then(() => {
        const location = selectedPlace.location;
        if (!location) throw new Error('No location');
        const municipality = municipalityFromPlace(selectedPlace);
        onSelect({
          ...place,
          secondary: selectedPlace.formattedAddress ?? place.secondary,
          position: { lat: location.lat(), lng: location.lng() },
          bounds: googleBounds(selectedPlace.viewport),
          zoom: selectedPlace.types?.includes('locality') ? 12 : 16,
          cityId: municipality?.id,
          cityName: municipality?.name,
        });
        sessionToken.current = null;
        predictionById.current.clear();
      })
      .catch(() => {
        setSearchError('No hemos podido localizar ese resultado. Prueba otra búsqueda.');
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="search" ref={rootRef}>
      <Search className="search__leading" size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Buscar ciudad, barrio, dirección o código postal
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={query}
        placeholder={placeholder ?? 'Ciudad, barrio o código postal…'}
        autoComplete="off"
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((value) => Math.min(suggestions.length - 1, value + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((value) => Math.max(0, value - 1));
          } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            const place = suggestions[activeIndex];
            if (place) select(place);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {loading ? (
        <LoaderCircle className="search__loader" size={18} aria-label="Buscando" />
      ) : query ? (
        <button
          className="search__clear"
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
        >
          <X size={18} />
        </button>
      ) : null}
      {open && suggestions.length > 0 && (
        <ul className="search__results" id={listId} role="listbox">
          {suggestions.map((place, index) => (
            <li
              id={`${listId}-${index}`}
              key={place.id}
              role="option"
              aria-selected={activeIndex === index}
            >
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(place)}
              >
                <MapPin size={17} aria-hidden="true" />
                <span>
                  <strong>{place.primary}</strong>
                  <small>{place.secondary}</small>
                </span>
                {place.source === 'local' && <em>directo</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && suggestions.length === 0 && !loading && !searchError && (
        <p className="search__hint">Puedes buscar por ciudad, barrio, dirección o código postal.</p>
      )}
      {searchError && (
        <span className="search__error" role="alert">
          {searchError}
        </span>
      )}
    </div>
  );
}
