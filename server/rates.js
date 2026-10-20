import { FALLBACK_EUR_RATES, CURRENCIES } from '../shared/rates.js';

const TTL_MS = 60 * 60 * 1000; // 1 hour
let cache = null;

// Returns EUR-based reference rates. Live data from open.er-api.com, cached for an hour,
// falling back to bundled estimates when the service is unreachable.
export async function getEurRates() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.value;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://open.er-api.com/v6/latest/EUR', { signal: ctrl.signal });
    clearTimeout(timer);
    const d = await r.json();
    if (!r.ok || d.result !== 'success' || !d.rates) throw new Error('bad response');
    const rates = {};
    for (const c of CURRENCIES) rates[c] = Number(d.rates[c]) || FALLBACK_EUR_RATES[c];
    const value = { base: 'EUR', rates, source: 'live', provider: 'open.er-api.com', updated: d.time_last_update_utc || new Date().toUTCString() };
    cache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    const value = { base: 'EUR', rates: { ...FALLBACK_EUR_RATES }, source: 'fallback', provider: 'bundled offline estimates', updated: null };
    // Cache the fallback briefly so we retry the live service soon.
    cache = { value, fetchedAt: Date.now() - TTL_MS + 5 * 60 * 1000 };
    return value;
  }
}
