import { convert, CURRENCIES } from '../shared/rates.js';
import { compareTransfers } from '../shared/transfers.js';
import { studyPlan, CITIES } from '../shared/cities.js';
import { scamCheck } from '../shared/scam.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_CATEGORIES, BUDGET_CATEGORIES } from '../shared/categories.js';
import { str, num, isDate } from './security.js';

/*
 * Tool design
 * -----------
 * READ tools run on the server and return data to the model.
 * WRITE tools never change anything: they only create a *proposal* that the user must approve
 * in the UI. The server validates each proposal against the user's agent policy first.
 */
export const WRITE_TOOLS = new Set(['propose_add_transaction', 'propose_payment_reminder', 'propose_budget_limit', 'propose_savings_goal']);
export const MAX_PROPOSALS_PER_TURN = 3;

const currencyProp = { type: 'string', enum: CURRENCIES, description: 'ISO currency code' };

export const TOOL_DEFINITIONS = [
  { name: 'get_financial_summary', description: 'Get the user\'s current financial summary: planned income, recorded income and expenses (EUR), balance, spending per category, category limits, savings goal and recent transactions.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'list_upcoming_payments', description: 'List unpaid payment reminders with days until due (negative means overdue).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'convert_currency', description: 'Convert an amount between currencies using current reference (mid-market) rates.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' }, from: currencyProp, to: currencyProp }, required: ['amount', 'from', 'to'] } },
  { name: 'compare_transfer_options', description: 'Compare the cost of sending money across borders through different provider types (bank wire, remittance agent, online transfer app, fintech app, wallet, postal order). Returns amount received, fees, FX margin and speed, best first.',
    input_schema: { type: 'object', properties: { amount: { type: 'number', description: 'Amount the sender pays, in the from currency' }, from: currencyProp, to: currencyProp }, required: ['amount', 'from', 'to'] } },
  { name: 'estimate_study_abroad_budget', description: `Estimate monthly and total costs of studying in a city and compare with expected income. Cities: ${CITIES.map(c => c.city).join(', ')}. All amounts in EUR.`,
    input_schema: { type: 'object', properties: {
      city: { type: 'string' }, months: { type: 'integer', minimum: 1, maximum: 60 },
      family_support: { type: 'number', description: 'Monthly support from family (EUR)' },
      scholarship: { type: 'number', description: 'Monthly scholarship (EUR)' },
      part_time_hourly: { type: 'number' }, part_time_hours_per_week: { type: 'number' },
      one_off_costs: { type: 'number', description: 'Total one-off costs: flights, deposit, visa, setup (EUR)' }
    }, required: ['city'] } },
  { name: 'check_message_for_scam', description: 'Run the rule-based scam detector on a message, job offer, rental listing or scholarship email the user received. Returns risk level and the signals found.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'propose_add_transaction', description: 'PROPOSE recording an income or expense. Does not save anything: the user must approve it. Use only when the user asks to record something.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' }, amount: { type: 'number' }, currency: currencyProp,
      type: { type: 'string', enum: ['expense', 'income'] },
      category: { type: 'string', enum: [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])] },
      date: { type: 'string', description: 'YYYY-MM-DD, default today' }, note: { type: 'string' },
      reason: { type: 'string', description: 'One sentence shown to the user explaining the proposal' }
    }, required: ['title', 'amount', 'type', 'category', 'reason'] } },
  { name: 'propose_payment_reminder', description: 'PROPOSE adding a bill or payment reminder. The user must approve it.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' }, amount: { type: 'number', description: 'EUR' }, due: { type: 'string', description: 'YYYY-MM-DD' },
      category: { type: 'string', enum: PAYMENT_CATEGORIES }, reason: { type: 'string' }
    }, required: ['title', 'amount', 'due', 'category', 'reason'] } },
  { name: 'propose_budget_limit', description: 'PROPOSE changing the monthly spending limit of one budget category (EUR). The user must approve it.',
    input_schema: { type: 'object', properties: { category: { type: 'string', enum: BUDGET_CATEGORIES }, limit: { type: 'number' }, reason: { type: 'string' } }, required: ['category', 'limit', 'reason'] } },
  { name: 'propose_savings_goal', description: 'PROPOSE changing the monthly savings goal (EUR). The user must approve it.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' }, reason: { type: 'string' } }, required: ['amount', 'reason'] } }
];

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const cur = c => (CURRENCIES.includes(c) ? c : null);

/**
 * Execute one tool call.
 * Returns { result } for the model, and optionally { proposal } for the UI.
 */
export function runTool(name, input = {}, { context, rates, proposalsSoFar = 0 }) {
  const policy = context.agent;
  const eur = rates.rates;
  switch (name) {
    case 'get_financial_summary': {
      const { agent, payments, ...summary } = context;
      return { result: { ...summary, amountsIn: 'EUR' } };
    }
    case 'list_upcoming_payments': {
      const list = context.payments.filter(p => !p.paid).map(p => ({ ...p, daysUntilDue: isDate(p.due) ? daysBetween(context.today, p.due) : null }))
        .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999));
      return { result: { today: context.today, unpaid: list, totalDueEur: list.reduce((s, p) => s + p.amountEur, 0) } };
    }
    case 'convert_currency': {
      const from = cur(input.from), to = cur(input.to);
      const value = from && to ? convert(num(input.amount, { min: 0 }), from, to, eur) : null;
      if (value == null) return { result: { error: 'Unsupported currency.' } };
      return { result: { amount: num(input.amount), from, to, converted: Math.round(value * 100) / 100, rateSource: rates.source } };
    }
    case 'compare_transfer_options': {
      const from = cur(input.from), to = cur(input.to);
      if (!from || !to) return { result: { error: 'Unsupported currency.' } };
      const r = compareTransfers(num(input.amount, { min: 0, max: 1e7 }), from, to, eur);
      return { result: { ...r, rateSource: rates.source, disclaimer: 'Illustrative provider types and typical fees; confirm the final quote with the provider.' } };
    }
    case 'estimate_study_abroad_budget': {
      const r = studyPlan({
        cityId: str(input.city, 40), months: num(input.months || 10, { min: 1, max: 60 }),
        incomes: { family: num(input.family_support, { min: 0 }), scholarship: num(input.scholarship, { min: 0 }), partTimeHourly: num(input.part_time_hourly, { min: 0, max: 200 }), partTimeHours: num(input.part_time_hours_per_week, { min: 0, max: 60 }) },
        oneOff: { total: num(input.one_off_costs, { min: 0 }) }
      });
      return { result: { ...r, disclaimer: 'Indicative estimates for planning only.' } };
    }
    case 'check_message_for_scam':
      return { result: scamCheck(str(input.text, 5000)) };
  }

  // ----- WRITE tools: validate and create proposals only -----
  if (!WRITE_TOOLS.has(name)) return { result: { error: `Unknown tool ${name}` } };
  if (!policy.enabled) return { result: { error: 'The user has paused the agent. You may not propose changes. Tell the user they can re-enable it in Settings.' } };
  if (proposalsSoFar >= MAX_PROPOSALS_PER_TURN) return { result: { error: `Policy: at most ${MAX_PROPOSALS_PER_TURN} proposals per message.` } };
  const reason = str(input.reason, 240) || 'Proposed by the assistant.';
  const reject = msg => ({ result: { status: 'rejected_by_policy', error: msg } });
  const make = (type, params) => {
    const proposal = { id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, type, params, reason };
    return { proposal, result: { status: 'proposed', awaiting: 'user approval in the app', proposalId: proposal.id, params } };
  };

  if (name === 'propose_add_transaction') {
    const type = input.type === 'income' ? 'income' : 'expense';
    const currency = cur(input.currency) || 'EUR';
    const original = num(input.amount, { min: 0, max: 1e7 });
    const amountEur = Math.round((convert(original, currency, 'EUR', eur) || 0) * 100) / 100;
    const allowed = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = allowed.includes(input.category) ? input.category : (type === 'income' ? 'Income' : 'Other');
    const title = str(input.title, 80);
    const date = isDate(input.date) ? input.date : context.today;
    if (!title) return reject('A title is required.');
    if (!(amountEur > 0)) return reject('Amount must be greater than zero.');
    if (amountEur > policy.maxActionAmount) return reject(`Amount €${amountEur} exceeds the user's per-action agent limit of €${policy.maxActionAmount}. Ask the user to add it manually or raise the limit in Settings.`);
    return make('add_transaction', { title, amount: amountEur, originalAmount: original, originalCurrency: currency, type, category, date, note: str(input.note, 120) });
  }
  if (name === 'propose_payment_reminder') {
    const title = str(input.title, 80), amount = num(input.amount, { min: 0, max: 1e7 });
    if (!title) return reject('A title is required.');
    if (!(amount > 0)) return reject('Amount must be greater than zero.');
    if (!isDate(input.due)) return reject('Due date must be YYYY-MM-DD.');
    if (amount > policy.maxActionAmount) return reject(`Amount €${amount} exceeds the user's per-action agent limit of €${policy.maxActionAmount}.`);
    const category = PAYMENT_CATEGORIES.includes(input.category) ? input.category : 'Other';
    return make('add_payment', { title, amount, due: input.due, category });
  }
  if (name === 'propose_budget_limit') {
    if (!BUDGET_CATEGORIES.includes(input.category)) return reject('Unknown category.');
    const limit = num(input.limit, { min: 0, max: 100000 });
    return make('set_budget_limit', { category: input.category, limit, previous: context.categoryLimits[input.category] ?? null });
  }
  if (name === 'propose_savings_goal') {
    const amount = num(input.amount, { min: 0, max: 100000 });
    return make('set_savings_goal', { amount, previous: context.savingsGoal });
  }
  return { result: { error: 'Unhandled tool.' } };
}
