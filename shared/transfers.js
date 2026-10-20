import { convert, midRate } from './rates.js';

// Illustrative provider TYPES (not real companies). Fees are typical public ranges for
// demonstration only; the UI always tells users to confirm the final quote with the provider.
export const PROVIDERS = [
  { id: 'bank', name: 'Bank wire (SWIFT)', fixedFeeEur: 15, pctFee: 0.002, fxMargin: 0.025, speed: '2–4 business days', note: 'Recipient bank may also charge an incoming fee.' },
  { id: 'cash', name: 'Cash-pickup remittance agent', fixedFeeEur: 5, pctFee: 0.03, fxMargin: 0.02, speed: 'Minutes', note: 'Convenient when the recipient has no bank account.' },
  { id: 'online', name: 'Online transfer app (mid-market rate)', fixedFeeEur: 0.5, pctFee: 0.006, fxMargin: 0, speed: 'Same day – 1 day', note: 'Usually the cheapest for bank-to-bank transfers.' },
  { id: 'fintech', name: 'Digital bank / fintech app', fixedFeeEur: 0, pctFee: 0, fxMargin: 0.007, speed: 'Instant (same app) – 1 day', note: 'Weekend and monthly-limit surcharges may apply.' },
  { id: 'wallet', name: 'Online payment wallet', fixedFeeEur: 0, pctFee: 0.05, fxMargin: 0.035, speed: 'Instant', note: 'Easy but often expensive for currency conversion.' },
  { id: 'post', name: 'Postal money order', fixedFeeEur: 3, pctFee: 0.025, fxMargin: 0.015, speed: '1–3 days', note: 'Available in many post offices.' }
];

/**
 * Compare providers for sending `amount` (in `from` currency) to a recipient in `to` currency.
 * Returns options sorted by amount received (best first).
 */
export function compareTransfers(amount, from, to, eurRates) {
  const sendAmount = Number(amount);
  if (!(sendAmount > 0)) return { error: 'Amount must be greater than zero.' };
  const mid = midRate(from, to, eurRates);
  if (!mid) return { error: `Unsupported currency pair ${from}/${to}.` };
  const sameCurrency = from === to;
  const options = PROVIDERS.map(p => {
    const fixed = convert(p.fixedFeeEur, 'EUR', from, eurRates);
    const fee = fixed + sendAmount * p.pctFee;
    const margin = sameCurrency ? 0 : p.fxMargin;
    const appliedRate = mid * (1 - margin);
    const received = Math.max(0, (sendAmount - fee) * appliedRate);
    const totalCost = sendAmount - received / mid; // in source currency
    return {
      id: p.id, provider: p.name, speed: p.speed, note: p.note,
      fee: round(fee), fxMargin: margin, appliedRate: round(appliedRate, 6),
      received: round(received), totalCost: round(totalCost),
      costPct: round((totalCost / sendAmount) * 100, 2)
    };
  }).sort((a, b) => b.received - a.received);
  const best = options[0];
  const worst = options[options.length - 1];
  return {
    amount: sendAmount, from, to, midRate: round(mid, 6), options,
    savingsVsWorst: round(best.received - worst.received),
    bestProvider: best.provider
  };
}

function round(n, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }
