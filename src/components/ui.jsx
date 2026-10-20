import React from 'react';
import {
  X, Trash2, Landmark, CircleDollarSign, ArrowLeftRight, GraduationCap, ArrowDownLeft, Sparkles,
  CreditCard, HeartPulse, Send, Check, ShieldCheck, Bot, AlertTriangle, AlertOctagon, Info, ArrowUpRight
} from 'lucide-react';
import { dateLabel, formatIn } from '../lib/util.js';

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

export function StatCard({ label, value, change, good, icon: Icon, tone = 'violet', sub }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-bottom">{change && <span className={good ? 'positive' : 'negative'}>{change}</span>}<span>{sub}</span></div>
    </div>
  );
}

export function PageHeading({ eyebrow, title, text, children, live }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{live && <span className="live-dot" />} {eyebrow}</div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

const CAT_ICONS = { Housing: Landmark, Food: CircleDollarSign, Transport: ArrowLeftRight, Education: GraduationCap, Income: ArrowDownLeft, Allowance: ArrowDownLeft, Scholarship: GraduationCap, Salary: ArrowDownLeft, Freelance: ArrowDownLeft, Entertainment: Sparkles, Utilities: CreditCard, Health: HeartPulse, Transfers: Send };

export function TransactionTable({ transactions, onDelete, fmt, emptyText = 'No transactions yet.' }) {
  if (!transactions.length) return <div className="empty-state">{emptyText}</div>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          {transactions.map(t => {
            const Icon = CAT_ICONS[t.category] || CircleDollarSign;
            const foreign = t.originalCurrency && t.originalCurrency !== 'EUR';
            return (
              <tr key={t.id}>
                <td><div className="transaction-cell"><div className={`transaction-icon ${t.type}`}><Icon size={17} /></div><div><b>{t.title}</b>{(t.note || t.source === 'agent') && <small>{t.source === 'agent' ? 'Added via AI agent' : ''}{t.source === 'agent' && t.note ? ' · ' : ''}{t.note}</small>}</div></div></td>
                <td><span className="category-pill">{t.category}</span></td>
                <td className="date-cell">{dateLabel(t.date)}</td>
                <td className={`amount-cell ${t.type}`}>{t.type === 'income' ? '+' : '−'}{fmt(t.amount)}{foreign && <small className="orig-amount">{formatIn(t.originalAmount, t.originalCurrency)}</small>}</td>
                <td><button className="icon-btn row-delete" onClick={() => onDelete(t.id)} title="Delete transaction" aria-label={`Delete ${t.title}`}><Trash2 size={15} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ALERT_ICON = { danger: AlertOctagon, warn: AlertTriangle, info: Info };
export function AlertList({ alerts, onOpen, limit }) {
  const list = limit ? alerts.slice(0, limit) : alerts;
  if (!list.length) return <div className="empty-state small-empty"><ShieldCheck size={18} /> All clear — no alerts right now.</div>;
  return (
    <div className="alert-list">
      {list.map(a => {
        const Icon = ALERT_ICON[a.level];
        return (
          <button key={a.id} className={`alert-row alert-${a.level}`} onClick={() => onOpen?.(a.page)}>
            <Icon size={17} />
            <span><b>{a.title}</b><small>{a.detail}</small></span>
            <ArrowUpRight size={14} className="muted" />
          </button>
        );
      })}
    </div>
  );
}

export function describeAction(a, fmt) {
  const p = a.params;
  switch (a.type) {
    case 'add_transaction': return { title: `Record ${p.type}: ${p.title}`, lines: [`${p.type === 'income' ? '+' : '−'}${fmt(p.amount)}${p.originalCurrency !== 'EUR' ? ` (${formatIn(p.originalAmount, p.originalCurrency)})` : ''}`, `${p.category} · ${p.date}`] };
    case 'add_payment': return { title: `Add payment reminder: ${p.title}`, lines: [fmt(p.amount), `${p.category} · due ${p.due}`] };
    case 'set_budget_limit': return { title: `Change ${p.category} limit`, lines: [`${p.previous != null ? fmt(p.previous) : 'none'} → ${fmt(p.limit)} per month`] };
    case 'set_savings_goal': return { title: 'Change savings goal', lines: [`${fmt(p.previous)} → ${fmt(p.amount)}`] };
    default: return { title: a.type, lines: [] };
  }
}

export function ActionCard({ action, fmt, onApprove, onReject }) {
  const d = describeAction(action, fmt);
  const status = action.status || 'pending';
  return (
    <div className={`action-card action-${status}`}>
      <div className="action-head"><Bot size={15} /><span>Proposed action</span><span className={`action-status s-${status}`}>{status === 'pending' ? 'Needs your approval' : status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Expired'}</span></div>
      <b>{d.title}</b>
      {d.lines.map(l => <small key={l}>{l}</small>)}
      {action.reason && <p className="action-reason">“{action.reason}”</p>}
      {status === 'pending' && (
        <div className="action-buttons">
          <button className="secondary-btn" onClick={onReject}><X size={14} /> Reject</button>
          <button className="primary-btn" onClick={onApprove}><Check size={14} /> Approve</button>
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}
