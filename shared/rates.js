// Fallback reference rates (1 EUR = x). Used only when the live public rate service is unreachable.
// Values are approximate and are always labelled as "offline estimates" in the UI.
export const FALLBACK_EUR_RATES = {
  EUR: 1, ALL: 97.5, USD: 1.16, GBP: 0.86, CHF: 0.93, TRY: 48.5, CAD: 1.6, AUD: 1.75,
  PLN: 4.25, HUF: 390, CZK: 24.5, MKD: 61.5, RSD: 117, BAM: 1.956, SEK: 11.0, NOK: 11.7
};

export const CURRENCIES = Object.keys(FALLBACK_EUR_RATES);

// Convert using a table of EUR-based rates (1 EUR = rates[X]).
export function convert(amount, from, to, eurRates) {
  const a = Number(amount) || 0;
  const rf = eurRates?.[from];
  const rt = eurRates?.[to];
  if (!rf || !rt) return null;
  return (a / rf) * rt;
}

export function midRate(from, to, eurRates) {
  return convert(1, from, to, eurRates);
}
