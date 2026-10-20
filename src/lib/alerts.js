import { daysUntil } from './util.js';

/**
 * Proactive alerts computed from the user's own data.
 * level: 'danger' | 'warn' | 'info'
 */
export function computeAlerts({ transactions, payments, budget, today, balance }) {
  const alerts = [];
  const month = today.slice(0, 7);

  for (const p of payments.filter(x => !x.paid)) {
    const d = daysUntil(today, p.due);
    if (d < 0) alerts.push({ id: `pay-${p.id}`, level: 'danger', title: `${p.title} is ${-d} day${d === -1 ? '' : 's'} overdue`, detail: `€${p.amount} was due on ${p.due}.`, page: 'payments' });
    else if (d <= 3) alerts.push({ id: `pay-${p.id}`, level: 'warn', title: `${p.title} is due ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}`, detail: `€${p.amount} due on ${p.due}.`, page: 'payments' });
  }

  const spent = {};
  for (const t of transactions) {
    if (t.type === 'expense' && t.date.slice(0, 7) === month) spent[t.category] = (spent[t.category] || 0) + Number(t.amount);
  }
  for (const [cat, limit] of Object.entries(budget.categoryLimits || {})) {
    const s = spent[cat] || 0;
    if (!limit) continue;
    if (s > limit) alerts.push({ id: `lim-${cat}`, level: 'danger', title: `${cat} is over budget`, detail: `€${s.toFixed(2)} spent of €${limit} this month.`, page: 'budget' });
    else if (s >= limit * 0.8) alerts.push({ id: `lim-${cat}`, level: 'warn', title: `${cat} is at ${Math.round(s / limit * 100)}% of its limit`, detail: `€${(limit - s).toFixed(2)} left this month.`, page: 'budget' });
  }

  const monthExpenses = Object.values(spent).reduce((a, b) => a + b, 0);
  if (budget.income && monthExpenses > budget.income) {
    alerts.push({ id: 'over-income', level: 'danger', title: 'Spending is above your planned income', detail: `€${monthExpenses.toFixed(2)} spent vs €${budget.income} planned this month.`, page: 'budget' });
  }
  if (budget.savingsGoal && balance < budget.savingsGoal) {
    alerts.push({ id: 'savings', level: 'info', title: 'Savings goal not reached yet', detail: `€${Math.max(0, budget.savingsGoal - balance).toFixed(2)} to go.`, page: 'budget' });
  }
  const order = { danger: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
