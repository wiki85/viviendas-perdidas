import { HOUSEHOLD_SIZE } from './constants';

export function calculateImpact(dwellingsCount: number, householdSize = HOUSEHOLD_SIZE) {
  const safeCount = Math.max(0, Math.round(dwellingsCount));
  return {
    lostDwellings: safeCount,
    lostFamilies: safeCount,
    lostInhabitants: Math.round(safeCount * householdSize),
  };
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value);
}

export function formatListingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}
