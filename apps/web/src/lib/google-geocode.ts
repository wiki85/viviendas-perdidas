export function slugifyMunicipality(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function municipalityFromGeocoderResult(result: google.maps.GeocoderResult) {
  const country = result.address_components.find((entry) => entry.types.includes('country'));
  if (country?.short_name.toLocaleUpperCase('es') !== 'ES') return null;
  const component = result.address_components.find(
    (entry) =>
      entry.types.includes('locality') || entry.types.includes('administrative_area_level_3'),
  );
  if (!component) return null;
  const name = component.long_name;
  const id = slugifyMunicipality(name);
  return id ? { id, name } : null;
}

export function municipalityFromPlace(place: google.maps.places.Place) {
  const components = place.addressComponents ?? [];
  const country = components.find((entry) => entry.types.includes('country'));
  if (country?.shortText?.toLocaleUpperCase('es') !== 'ES') return null;
  const component = components.find(
    (entry) =>
      entry.types.includes('locality') || entry.types.includes('administrative_area_level_3'),
  );
  const name = component?.longText;
  if (!name) return null;
  const id = slugifyMunicipality(name);
  return id ? { id, name } : null;
}
