// Indicative monthly student living costs in EUR (shared room / student housing).
// Rounded estimates for planning and demonstration only; users should verify locally.
export const CITIES = [
  { id: 'tirana', city: 'Tirana', country: 'Albania', rent: 250, food: 180, transport: 15, utilities: 40, other: 90, insurance: 10 },
  { id: 'pristina', city: 'Pristina', country: 'Kosovo', rent: 200, food: 170, transport: 15, utilities: 40, other: 80, insurance: 10 },
  { id: 'milan', city: 'Milan', country: 'Italy', rent: 600, food: 280, transport: 39, utilities: 60, other: 140, insurance: 15 },
  { id: 'rome', city: 'Rome', country: 'Italy', rent: 520, food: 260, transport: 35, utilities: 60, other: 130, insurance: 15 },
  { id: 'bologna', city: 'Bologna', country: 'Italy', rent: 480, food: 250, transport: 27, utilities: 55, other: 120, insurance: 15 },
  { id: 'berlin', city: 'Berlin', country: 'Germany', rent: 550, food: 250, transport: 35, utilities: 50, other: 130, insurance: 120 },
  { id: 'munich', city: 'Munich', country: 'Germany', rent: 700, food: 280, transport: 35, utilities: 55, other: 140, insurance: 120 },
  { id: 'vienna', city: 'Vienna', country: 'Austria', rent: 500, food: 260, transport: 25, utilities: 50, other: 130, insurance: 70 },
  { id: 'paris', city: 'Paris', country: 'France', rent: 750, food: 300, transport: 43, utilities: 60, other: 150, insurance: 20 },
  { id: 'madrid', city: 'Madrid', country: 'Spain', rent: 550, food: 250, transport: 20, utilities: 55, other: 130, insurance: 40 },
  { id: 'ljubljana', city: 'Ljubljana', country: 'Slovenia', rent: 380, food: 220, transport: 20, utilities: 45, other: 110, insurance: 30 },
  { id: 'budapest', city: 'Budapest', country: 'Hungary', rent: 400, food: 220, transport: 10, utilities: 50, other: 110, insurance: 30 },
  { id: 'prague', city: 'Prague', country: 'Czechia', rent: 450, food: 230, transport: 10, utilities: 50, other: 120, insurance: 40 },
  { id: 'istanbul', city: 'Istanbul', country: 'Türkiye', rent: 300, food: 180, transport: 20, utilities: 40, other: 90, insurance: 20 },
  { id: 'london', city: 'London', country: 'United Kingdom', rent: 950, food: 320, transport: 110, utilities: 70, other: 180, insurance: 0 }
];

export const COST_KEYS = ['rent', 'food', 'transport', 'utilities', 'insurance', 'other'];

export function findCity(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  return CITIES.find(c => c.id === n || c.city.toLowerCase() === n) || null;
}

/**
 * Estimate a study-abroad budget.
 * incomes: { family, scholarship, partTimeHourly, partTimeHours (per week) } – all EUR
 * oneOff: { flights, deposit, visa, setup } – EUR
 */
export function studyPlan({ cityId, months = 10, incomes = {}, oneOff = {}, bufferPct = 10 }) {
  const city = findCity(cityId);
  if (!city) return { error: `Unknown city "${cityId}". Available: ${CITIES.map(c => c.city).join(', ')}.` };
  const breakdown = COST_KEYS.map(k => ({ key: k, amount: city[k] }));
  const base = breakdown.reduce((s, b) => s + b.amount, 0);
  const buffer = Math.round(base * (Number(bufferPct) || 0) / 100);
  const monthlyCost = base + buffer;
  const partTime = (Number(incomes.partTimeHourly) || 0) * (Number(incomes.partTimeHours) || 0) * 4.33;
  const monthlyIncome = (Number(incomes.family) || 0) + (Number(incomes.scholarship) || 0) + partTime;
  const monthlyGap = monthlyIncome - monthlyCost;
  const oneOffTotal = Object.values(oneOff).reduce((s, v) => s + (Number(v) || 0), 0);
  const m = Math.max(1, Number(months) || 1);
  const totalNeeded = monthlyCost * m + oneOffTotal;
  const totalIncome = monthlyIncome * m;
  return {
    city: city.city, country: city.country, months: m,
    breakdown, buffer, monthlyCost: Math.round(monthlyCost),
    monthlyIncome: Math.round(monthlyIncome), partTimeIncome: Math.round(partTime),
    monthlyGap: Math.round(monthlyGap), oneOffTotal: Math.round(oneOffTotal),
    totalNeeded: Math.round(totalNeeded), totalIncome: Math.round(totalIncome),
    totalGap: Math.round(totalIncome - totalNeeded),
    status: monthlyGap >= 0 ? (totalIncome - totalNeeded >= 0 ? 'covered' : 'one-off-gap') : 'monthly-gap'
  };
}
