// Display helpers. We show euros in the German locale (1.234,56 €) since users
// cross-reference with official forms, but all UI labels stay in English.

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(value: number): string {
  return eur.format(value ?? 0);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`;
}
