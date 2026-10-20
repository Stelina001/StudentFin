import React from 'react';
import { Plus, CalendarDays, CreditCard, Check, Trash2, ShieldCheck } from 'lucide-react';
import { PageHeading, StatCard } from '../components/ui.jsx';
import { dateLabel, daysUntil } from '../lib/util.js';

export default function Payments({ app }) {
  const { fmt, payments, upcomingPayments, today } = app;
  const dueLabel = p => {
    if (p.paid) return '';
    const d = daysUntil(today, p.due);
    if (d < 0) return <span className="due-badge danger">{-d}d overdue</span>;
    if (d <= 3) return <span className="due-badge warn">{d === 0 ? 'Due today' : `Due in ${d}d`}</span>;
    return null;
  };
  return (
    <>
      <PageHeading eyebrow="STAY ONE STEP AHEAD" title="Payments" text="Bills, tuition installments and subscriptions with due-date alerts.">
        <button className="primary-btn" onClick={() => app.setModal('payment')}><Plus size={17} /> Add payment</button>
      </PageHeading>
      <div className="stat-grid compact-stats">
        <StatCard label="Upcoming payments" value={String(upcomingPayments.length)} icon={CalendarDays} tone="violet" sub="unpaid reminders" />
        <StatCard label="Amount due" value={fmt(upcomingPayments.reduce((s, p) => s + p.amount, 0))} icon={CreditCard} tone="rose" sub="across unpaid items" />
        <StatCard label="Paid reminders" value={String(payments.filter(p => p.paid).length)} icon={Check} tone="mint" sub="marked complete" />
      </div>
      <section className="panel pad-panel">
        <div className="panel-head"><div><h2>Payment reminders</h2><p>Mark an item paid when you have completed it.</p></div></div>
        {payments.length ? (
          <div className="payment-list">
            {payments.slice().sort((a, b) => Number(a.paid) - Number(b.paid) || a.due.localeCompare(b.due)).map(p => (
              <div className={`payment-row ${p.paid ? 'payment-paid' : ''}`} key={p.id}>
                <div className={`payment-icon ${p.paid ? 'paid' : ''}`}><CreditCard size={18} /></div>
                <div className="payment-info"><b>{p.title} {dueLabel(p)}</b><small>{p.category} · Due {dateLabel(p.due)}{p.source === 'agent' ? ' · added via AI agent' : ''}</small></div>
                <b className="payment-amount">{fmt(p.amount)}</b>
                <button className={`mark-paid ${p.paid ? 'is-paid' : ''}`} onClick={() => app.togglePaid(p).catch(app.fail)}><Check size={14} /> {p.paid ? 'Paid' : 'Mark paid'}</button>
                <button className="icon-btn danger-btn" onClick={() => app.deletePayment(p.id).catch(app.fail)} aria-label={`Delete ${p.title}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">No payment reminders yet. Add one to get started.</div>}
      </section>
      <div className="notice"><ShieldCheck size={18} /><span>StudentFin AI tracks reminders only. It does not connect to your bank or send payments.</span></div>
    </>
  );
}
