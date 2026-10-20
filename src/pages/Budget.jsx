import React from 'react';
import { Plus, ArrowUpRight, Sparkles } from 'lucide-react';
import { PageHeading } from '../components/ui.jsx';
import { COLORS } from './Overview.jsx';

export default function Budget({ app }) {
  const { fmt, budget, transactions, today } = app;
  const month = today.slice(0, 7);
  const monthSpent = {};
  transactions.filter(t => t.type === 'expense' && t.date.slice(0, 7) === month).forEach(t => { monthSpent[t.category] = (monthSpent[t.category] || 0) + Number(t.amount); });
  const monthExpenses = Object.values(monthSpent).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, budget.income - monthExpenses);

  return (
    <>
      <PageHeading eyebrow="PLAN WITH PURPOSE" title="My budget" text="Give every euro a job, without losing flexibility.">
        <button className="primary-btn" onClick={() => app.setModal('transaction')}><Plus size={17} /> Add transaction</button>
      </PageHeading>
      <div className="budget-summary">
        <div className="budget-summary-main">
          <span>Available from planned monthly income</span>
          <h2>{fmt(remaining)}</h2>
          <p>{fmt(monthExpenses)} spent this month from a planned {fmt(budget.income)}</p>
          <div className="progress-track"><div className={monthExpenses > budget.income ? 'over-budget' : ''} style={{ width: `${Math.min(100, monthExpenses / Math.max(1, budget.income) * 100)}%` }} /></div>
        </div>
        <div className="budget-mini"><span>Monthly income plan</span><b>{fmt(budget.income)}</b><button className="text-btn" onClick={() => app.setModal('budget')}>Edit plan <ArrowUpRight size={14} /></button></div>
        <div className="budget-mini"><span>Savings goal</span><b>{fmt(budget.savingsGoal)}</b><button className="text-btn" onClick={() => app.setModal('budget')}>Edit goal <ArrowUpRight size={14} /></button></div>
      </div>
      <section className="panel pad-panel">
        <div className="panel-head"><div><h2>Category budgets</h2><p>This month’s spending compared with your limits</p></div><button className="secondary-btn" onClick={() => app.setModal('budget')}>Edit limits</button></div>
        <div className="budget-categories">
          {Object.entries(budget.categoryLimits).map(([cat, limit], i) => {
            const spent = monthSpent[cat] || 0;
            const pct = Math.min(100, spent / Math.max(1, limit) * 100);
            const over = limit > 0 && spent > limit;
            return (
              <div className="budget-category" key={cat}>
                <div className="budget-cat-top"><span className="category-name"><i style={{ background: COLORS[i % COLORS.length] }} />{cat}</span><span><b>{fmt(spent)}</b><small> / {fmt(limit)}</small></span></div>
                <div className="progress-track"><div className={pct >= 100 ? 'over-budget' : ''} style={{ width: `${pct}%` }} /></div>
                <small className={over ? 'negative' : pct >= 80 ? 'warn-text' : 'muted'}>{over ? `Over by ${fmt(spent - limit)}` : pct >= 100 ? 'Limit reached' : `${Math.round(pct)}% used · ${fmt(Math.max(0, limit - spent))} left`}</small>
              </div>
            );
          })}
        </div>
      </section>
      <section className="insight-card">
        <div className="insight-icon"><Sparkles size={20} /></div>
        <div><b>Let the agent review your budget</b><p>It reads your categories and limits and can prepare new limits for you to approve. Nothing changes until you tap Approve.</p></div>
        <button className="secondary-btn" onClick={() => app.askAgent('Review my budget limits against my spending this month and suggest realistic changes.')}>Ask the agent <ArrowUpRight size={14} /></button>
      </section>
    </>
  );
}
