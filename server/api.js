import express from 'express';
import { sequelize, User, Transaction, Payment, Proposal, ActivityLog, DEFAULT_LIMITS } from './db.js';
import { requireAuth, publicUser } from './auth.js';
import { seedUser, localToday } from './seed.js';
import { str, num, isDate, rateLimit } from './security.js';
import { getEurRates } from './rates.js';
import { runClaudeAgent, runDemoAgent } from './agent.js';
import { CURRENCIES } from '../shared/rates.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_CATEGORIES, BUDGET_CATEGORIES } from '../shared/categories.js';

export const api = express.Router();
api.use(requireAuth);

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
const own = req => ({ userId: req.user.id }); // every query is scoped to the logged-in user
const plain = rows => rows.map(r => r.get({ plain: true }));
const cleanTx = t => ({ id: t.id, title: t.title, amount: t.amount, type: t.type, category: t.category, date: t.date, note: t.note, originalAmount: t.originalAmount, originalCurrency: t.originalCurrency, source: t.source });
const cleanPay = p => ({ id: p.id, title: p.title, amount: p.amount, due: p.due, category: p.category, paid: p.paid, source: p.source });
const cleanLog = l => ({ id: l.id, time: l.createdAt, kind: l.kind, tool: l.tool, actionType: l.actionType, input: l.input, params: l.params, status: l.status, reason: l.reason, mode: l.mode });
const log = (userId, entry) => ActivityLog.create({ userId, ...entry });

// ---------- validation ----------
function validTransaction(b) {
  const type = b.type === 'income' ? 'income' : b.type === 'expense' ? 'expense' : null;
  const allowed = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const t = {
    title: str(b.title, 80), amount: Math.round(num(b.amount, { min: 0, max: 1e7 }) * 100) / 100, type,
    category: allowed.includes(b.category) ? b.category : null, date: b.date, note: str(b.note, 160),
    originalAmount: b.originalAmount != null ? num(b.originalAmount, { min: 0, max: 1e9 }) : null,
    originalCurrency: CURRENCIES.includes(b.originalCurrency) ? b.originalCurrency : 'EUR'
  };
  if (!t.title || !(t.amount > 0) || !t.type || !t.category || !isDate(t.date)) return null;
  return t;
}
function validPayment(b) {
  const p = { title: str(b.title, 80), amount: num(b.amount, { min: 0, max: 1e7 }), due: b.due, category: PAYMENT_CATEGORIES.includes(b.category) ? b.category : 'Other' };
  if (!p.title || !(p.amount > 0) || !isDate(p.due)) return null;
  return p;
}
function validLimits(obj) {
  const out = {};
  for (const c of BUDGET_CATEGORIES) out[c] = num(obj?.[c] ?? DEFAULT_LIMITS[c] ?? 0, { min: 0, max: 100000 });
  return out;
}

// ---------- read everything for the logged-in user ----------
api.get('/data', async (req, res) => {
  const [transactions, payments, activity, pending] = await Promise.all([
    Transaction.findAll({ where: own(req), order: [['date', 'DESC'], ['id', 'DESC']] }),
    Payment.findAll({ where: own(req), order: [['due', 'ASC']] }),
    ActivityLog.findAll({ where: own(req), order: [['id', 'DESC']], limit: 300 }),
    Proposal.findAll({ where: { ...own(req), status: 'pending' } })
  ]);
  res.json({ user: publicUser(req.user), transactions: transactions.map(cleanTx), payments: payments.map(cleanPay), activity: activity.map(cleanLog), pendingProposals: plain(pending).map(p => p.id) });
});

// ---------- transactions ----------
api.post('/transactions', async (req, res) => {
  const t = validTransaction(req.body || {});
  if (!t) return res.status(400).json({ error: 'Please check the title, amount, type, category and date.' });
  const row = await Transaction.create({ ...t, userId: req.user.id, source: 'manual' });
  res.status(201).json(cleanTx(row));
});
api.delete('/transactions/:id', async (req, res) => {
  const n = await Transaction.destroy({ where: { id: Number(req.params.id), ...own(req) } });
  res.status(n ? 200 : 404).json({ ok: Boolean(n) });
});

// ---------- payments ----------
api.post('/payments', async (req, res) => {
  const p = validPayment(req.body || {});
  if (!p) return res.status(400).json({ error: 'Please check the title, amount and due date.' });
  const row = await Payment.create({ ...p, userId: req.user.id, source: 'manual' });
  res.status(201).json(cleanPay(row));
});
api.patch('/payments/:id', async (req, res) => {
  const row = await Payment.findOne({ where: { id: Number(req.params.id), ...own(req) } });
  if (!row) return res.status(404).json({ error: 'Not found.' });
  await row.update({ paid: Boolean(req.body?.paid) });
  res.json(cleanPay(row));
});
api.delete('/payments/:id', async (req, res) => {
  const n = await Payment.destroy({ where: { id: Number(req.params.id), ...own(req) } });
  res.status(n ? 200 : 404).json({ ok: Boolean(n) });
});

// ---------- budget, profile, agent settings ----------
api.put('/budget', async (req, res) => {
  const b = req.body || {};
  await req.user.update({ monthlyIncome: num(b.income, { min: 0, max: 1e6 }), savingsGoal: num(b.savingsGoal, { min: 0, max: 1e6 }), categoryLimits: validLimits(b.categoryLimits) });
  res.json({ user: publicUser(req.user) });
});
api.put('/profile', async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.name !== undefined) { const n = str(b.name, 80); if (n.length >= 1) patch.name = n; }
  if (b.country !== undefined) patch.country = str(b.country, 60);
  if (b.studyCity !== undefined) patch.studyCity = str(b.studyCity, 40);
  if (b.currency !== undefined && CURRENCIES.includes(b.currency)) patch.currency = b.currency;
  await req.user.update(patch);
  res.json({ user: publicUser(req.user) });
});
api.put('/agent-settings', async (req, res) => {
  const b = req.body || {};
  const enabled = Boolean(b.enabled);
  const maxActionAmount = num(b.maxActionAmount, { min: 1, max: 5000 }) || 300;
  const changed = enabled !== req.user.agentEnabled;
  await req.user.update({ agentEnabled: enabled, maxActionAmount });
  if (changed) {
    await log(req.user.id, { kind: 'manual', actionType: 'agent_toggle', params: { enabled }, status: enabled ? 'enabled' : 'paused' });
    if (!enabled) await Proposal.update({ status: 'expired' }, { where: { ...own(req), status: 'pending' } });
  }
  res.json({ user: publicUser(req.user) });
});

// ---------- activity log ----------
api.post('/activity', async (req, res) => {
  const b = req.body || {};
  const row = await log(req.user.id, { kind: 'manual', actionType: str(b.actionType, 60), params: b.params && typeof b.params === 'object' ? JSON.parse(JSON.stringify(b.params).slice(0, 2000) || '{}') : null, status: str(b.status, 40), reason: str(b.reason, 240) });
  res.status(201).json(cleanLog(row));
});
api.delete('/activity', async (req, res) => {
  await ActivityLog.destroy({ where: own(req) });
  res.json({ ok: true });
});

// ---------- reset / import ----------
api.post('/reset', async (req, res) => {
  await seedUser(req.user);
  await ActivityLog.destroy({ where: own(req) });
  res.json({ ok: true });
});
api.post('/import', async (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.transactions) || !Array.isArray(b.payments)) return res.status(400).json({ error: 'Not a StudentFin backup.' });
  const txs = b.transactions.slice(0, 5000).map(validTransaction).filter(Boolean);
  const pays = b.payments.slice(0, 1000).map(p => { const v = validPayment(p); return v && { ...v, paid: Boolean(p.paid) }; }).filter(Boolean);
  await sequelize.transaction(async (t) => {
    await Transaction.destroy({ where: own(req), transaction: t });
    await Payment.destroy({ where: own(req), transaction: t });
    await Transaction.bulkCreate(txs.map(x => ({ ...x, userId: req.user.id, source: 'import' })), { transaction: t });
    await Payment.bulkCreate(pays.map(x => ({ ...x, userId: req.user.id, source: 'import' })), { transaction: t });
    if (b.budget) await req.user.update({ monthlyIncome: num(b.budget.income, { min: 0 }), savingsGoal: num(b.budget.savingsGoal, { min: 0 }), categoryLimits: validLimits(b.budget.categoryLimits) }, { transaction: t });
  });
  await log(req.user.id, { kind: 'manual', actionType: 'import_backup', params: { transactions: txs.length, payments: pays.length }, status: 'applied' });
  res.json({ ok: true, imported: { transactions: txs.length, payments: pays.length } });
});

// ---------- AI agent ----------
// The agent's context is built from the database on the server: the browser cannot inject fake balances or limits.
async function buildContext(user) {
  const today = localToday();
  const [txs, pays] = await Promise.all([
    Transaction.findAll({ where: { userId: user.id }, order: [['date', 'DESC'], ['id', 'DESC']] }),
    Payment.findAll({ where: { userId: user.id } })
  ]);
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const cat = {};
  txs.filter(t => t.type === 'expense').forEach(t => { cat[t.category] = (cat[t.category] || 0) + t.amount; });
  return {
    today, displayCurrency: user.currency, monthlyIncomePlan: user.monthlyIncome, savingsGoal: user.savingsGoal,
    income: round(income), expenses: round(expenses), balance: round(income - expenses),
    categorySpending: Object.entries(cat).map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value),
    categoryLimits: user.categoryLimits || {},
    recentTransactions: txs.slice(0, 30).map(t => ({ title: t.title, category: t.category, date: t.date, amountEur: t.amount, type: t.type, originalAmount: t.originalAmount, originalCurrency: t.originalCurrency })),
    payments: pays.map(p => ({ title: p.title, amountEur: p.amount, due: p.due, paid: p.paid })),
    agent: { enabled: user.agentEnabled, maxActionAmount: user.maxActionAmount }
  };
}
const round = n => Math.round(n * 100) / 100;

api.post('/agent', rateLimit({ max: 20 }), async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Send at least one chat message.' });
  const safe = messages.slice(-16).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: str(m.content, 6000) })).filter(m => m.content);
  while (safe.length && safe[0].role !== 'user') safe.shift();
  if (!safe.length) return res.status(400).json({ error: 'Send at least one chat message.' });
  if (!req.user.agentEnabled) return res.json({ answer: 'The assistant is paused. Turn it back on in Settings → Agent controls.', actions: [], trace: [], mode: 'paused' });

  // A new request expires any proposals the user has not decided on.
  await Proposal.update({ status: 'expired' }, { where: { ...own(req), status: 'pending' } });
  const context = await buildContext(req.user);
  const rates = await getEurRates();
  try {
    const result = hasKey() ? await runClaudeAgent({ messages: safe, context, rates }) : runDemoAgent({ messages: safe, context, rates });
    await Proposal.bulkCreate(result.actions.map(a => ({ id: a.id, userId: req.user.id, type: a.type, params: a.params, reason: a.reason, status: 'pending' })));
    await ActivityLog.bulkCreate([
      ...result.trace.map(t => ({ userId: req.user.id, kind: 'tool', tool: t.tool, input: t.input, status: t.status, mode: result.mode })),
      ...result.actions.map(a => ({ userId: req.user.id, kind: 'proposal', actionType: a.type, params: a.params, reason: a.reason, status: 'pending', mode: result.mode }))
    ]);
    res.json(result);
  } catch (error) {
    console.error('Agent error:', error?.status || '', error?.message || error);
    res.status(502).json({ error: error?.status === 401 ? 'Anthropic rejected the API key. Check that your key is correct and active.'
      : error?.status === 404 ? 'The configured model was not found. Check ANTHROPIC_MODEL in .env.'
        : hasKey() ? 'Claude could not respond. Check your API key, model access, connection and usage limits, then try again.' : 'The demo agent hit an internal error. Please try rephrasing.' });
  }
});

// Approve or reject a stored proposal. This is the ONLY code path through which the agent changes user data.
api.post('/proposals/:id/decision', async (req, res) => {
  const decision = req.body?.decision === 'approved' ? 'approved' : req.body?.decision === 'rejected' ? 'rejected' : null;
  if (!decision) return res.status(400).json({ error: 'Decision must be approved or rejected.' });
  const p = await Proposal.findOne({ where: { id: str(req.params.id, 40), ...own(req) } });
  if (!p) return res.status(404).json({ error: 'Proposal not found.' });
  if (p.status !== 'pending') return res.status(409).json({ error: `This proposal is already ${p.status}.`, status: p.status });
  const u = req.user;

  if (decision === 'approved') {
    if (!u.agentEnabled) return res.status(403).json({ error: 'The agent is paused. Turn it on in Settings to approve actions.' });
    const params = p.params;
    // Re-check the policy at approval time (the user may have lowered the limit since).
    if ((p.type === 'add_transaction' || p.type === 'add_payment') && params.amount > u.maxActionAmount) {
      await p.update({ status: 'blocked', decidedAt: new Date() });
      await log(u.id, { kind: 'decision', actionType: p.type, params, reason: p.reason, status: 'rejected_by_policy' });
      return res.status(403).json({ error: `Amount exceeds your current per-action limit of €${u.maxActionAmount}.`, status: 'blocked' });
    }
    await sequelize.transaction(async (t) => {
      if (p.type === 'add_transaction') await Transaction.create({ userId: u.id, title: params.title, amount: params.amount, type: params.type, category: params.category, date: params.date, note: params.note || '', originalAmount: params.originalAmount, originalCurrency: params.originalCurrency, source: 'agent' }, { transaction: t });
      else if (p.type === 'add_payment') await Payment.create({ userId: u.id, title: params.title, amount: params.amount, due: params.due, category: params.category, source: 'agent' }, { transaction: t });
      else if (p.type === 'set_budget_limit') await u.update({ categoryLimits: { ...u.categoryLimits, [params.category]: params.limit } }, { transaction: t });
      else if (p.type === 'set_savings_goal') await u.update({ savingsGoal: params.amount }, { transaction: t });
      await p.update({ status: 'approved', decidedAt: new Date() }, { transaction: t });
    });
  } else {
    await p.update({ status: 'rejected', decidedAt: new Date() });
  }
  await log(u.id, { kind: 'decision', actionType: p.type, params: p.params, reason: p.reason, status: decision });
  res.json({ ok: true, status: decision });
});
