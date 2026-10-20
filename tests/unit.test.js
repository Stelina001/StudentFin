// Unit tests for the pure domain modules and the agent tool policy (no server, no network).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTransfers, PROVIDERS } from '../shared/transfers.js';
import { scamCheck } from '../shared/scam.js';
import { studyPlan, CITIES } from '../shared/cities.js';
import { convert, FALLBACK_EUR_RATES } from '../shared/rates.js';
import { runTool, WRITE_TOOLS, TOOL_DEFINITIONS, MAX_PROPOSALS_PER_TURN } from '../server/tools.js';

const R = FALLBACK_EUR_RATES;
const rates = { rates: R, source: 'test' };
const ctx = (agent = {}) => ({
  today: '2026-10-20', displayCurrency: 'EUR', monthlyIncomePlan: 1200, savingsGoal: 250,
  income: 1500, expenses: 900, balance: 600, categorySpending: [{ name: 'Food', value: 200 }],
  categoryLimits: { Food: 180 }, recentTransactions: [], payments: [],
  agent: { enabled: true, maxActionAmount: 300, ...agent }
});

// ---------- T-U01 … T-U04: transfer cost model ----------
test('T-U01 transfer model: fee = F·r + p·A, received = (A − fee)·m·(1 − μ)', () => {
  const r = compareTransfers(500, 'EUR', 'ALL', R);
  const bank = r.options.find(o => o.id === 'bank');
  const p = PROVIDERS.find(x => x.id === 'bank');
  const fee = p.fixedFeeEur + 500 * p.pctFee;
  const expected = (500 - fee) * 97.5 * (1 - p.fxMargin);
  assert.equal(bank.fee, Math.round(fee * 100) / 100);
  assert.ok(Math.abs(bank.received - expected) < 0.01);
});
test('T-U02 transfer options are ranked by amount received, best first', () => {
  const r = compareTransfers(60000, 'ALL', 'EUR', R);
  assert.equal(r.options.length, 6);
  for (let i = 1; i < r.options.length; i++) assert.ok(r.options[i - 1].received >= r.options[i].received);
  assert.equal(r.bestProvider, r.options[0].provider);
  assert.ok(r.savingsVsWorst > 0);
});
test('T-U03 same-currency transfers apply no FX margin', () => {
  const r = compareTransfers(100, 'EUR', 'EUR', R);
  assert.ok(r.options.every(o => o.fxMargin === 0));
});
test('T-U04 invalid transfer input is rejected', () => {
  assert.ok(compareTransfers(0, 'EUR', 'ALL', R).error);
  assert.ok(compareTransfers(100, 'EUR', 'XXX', R).error);
});

// ---------- T-U05 … T-U07: scam detector ----------
test('T-U05 classic rental scam scores HIGH with explainable signals', () => {
  const r = scamCheck('Pay the deposit by Western Union today, I am abroad and keys will be sent');
  assert.equal(r.level, 'high');
  const ids = r.signals.map(s => s.id);
  for (const id of ['upfront', 'untraceable', 'abroad']) assert.ok(ids.includes(id), id);
  assert.ok(r.signals.every(s => s.why && s.excerpt));
});
test('T-U06 a normal message scores LOW', () => {
  const r = scamCheck('Hi, the lecture tomorrow moves to room 204. See you there.');
  assert.equal(r.level, 'low');
  assert.equal(r.score, 0);
});
test('T-U07 score is capped at 10 and empty input is rejected', () => {
  const r = scamCheck('URGENT: send your OTP and PIN, pay the processing fee in bitcoin, you have won a prize, contact me on telegram https://bit.ly/x, embassy');
  assert.equal(r.score, 10);
  assert.ok(scamCheck('   ').error);
});

// ---------- T-U08 … T-U09: study-abroad planner ----------
test('T-U08 study planner: monthly gap = income − (costs + 10% buffer)', () => {
  const r = studyPlan({ cityId: 'milan', months: 10, incomes: { family: 700 } });
  const base = r.breakdown.reduce((s, b) => s + b.amount, 0);
  assert.equal(r.monthlyCost, base + Math.round(base * 0.1));
  assert.equal(r.monthlyGap, 700 - r.monthlyCost);
  assert.equal(CITIES.length, 15);
});
test('T-U09 study planner rejects unknown cities', () => {
  assert.ok(studyPlan({ cityId: 'atlantis' }).error);
});

// ---------- T-U10: currency conversion ----------
test('T-U10 currency conversion uses EUR-based reference rates', () => {
  assert.equal(convert(100, 'EUR', 'ALL', R), 9750);
  assert.equal(Math.round(convert(9750, 'ALL', 'EUR', R)), 100);
  assert.equal(convert(1, 'EUR', 'XXX', R), null);
});

// ---------- T-U11 … T-U16: agent permission tiers ----------
test('T-U11 tool catalogue: 10 tools, exactly 4 write tools and all of them are propose-only', () => {
  assert.equal(TOOL_DEFINITIONS.length, 10);
  assert.equal(WRITE_TOOLS.size, 4);
  for (const t of WRITE_TOOLS) assert.ok(t.startsWith('propose_'));
});
test('T-U12 write tools only create proposals; nothing is applied', () => {
  const out = runTool('propose_add_transaction', { title: 'Books', amount: 40, type: 'expense', category: 'Education' }, { context: ctx(), rates });
  assert.equal(out.result.status, 'proposed');
  assert.equal(out.proposal.type, 'add_transaction');
  assert.match(out.proposal.id, /^act_/);
});
test('T-U13 per-action amount limit blocks large proposals', () => {
  const out = runTool('propose_add_transaction', { title: 'Laptop', amount: 900, type: 'expense', category: 'Other' }, { context: ctx(), rates });
  assert.equal(out.result.status, 'rejected_by_policy');
  assert.equal(out.proposal, undefined);
});
test('T-U14 limit applies after currency conversion (60 000 ALL ≈ €615 > €300)', () => {
  const out = runTool('propose_add_transaction', { title: 'Rent', amount: 60000, currency: 'ALL', type: 'expense', category: 'Housing' }, { context: ctx(), rates });
  assert.equal(out.result.status, 'rejected_by_policy');
});
test('T-U15 kill switch: a paused agent cannot propose anything', () => {
  const out = runTool('propose_savings_goal', { amount: 100 }, { context: ctx({ enabled: false }), rates });
  assert.ok(out.result.error);
  assert.equal(out.proposal, undefined);
});
test('T-U16 at most 3 proposals per message; unknown tools are refused', () => {
  const out = runTool('propose_savings_goal', { amount: 100 }, { context: ctx(), rates, proposalsSoFar: MAX_PROPOSALS_PER_TURN });
  assert.match(out.result.error, /at most 3/);
  assert.match(runTool('transfer_money', {}, { context: ctx(), rates }).result.error, /Unknown tool/);
});
