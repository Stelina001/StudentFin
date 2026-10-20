import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from './ui.jsx';
import { CURRENCIES } from '../../shared/rates.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_CATEGORIES } from '../../shared/categories.js';
import { formatIn } from '../lib/util.js';

export function TransactionModal({ app, onClose }) {
  const [f, setF] = useState({ title: '', amount: '', currency: 'EUR', type: 'expense', category: 'Food', date: app.today, note: '' });
  const amountEur = f.amount ? app.toEur(Number(f.amount), f.currency) : 0;
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!f.title.trim() || !(Number(f.amount) > 0) || busy) return;
    setBusy(true);
    try { await app.addTransaction({
      title: f.title.trim(), amount: Math.round(amountEur * 100) / 100, type: f.type, category: f.category, date: f.date, note: f.note.trim(),
      originalAmount: Number(f.amount), originalCurrency: f.currency
    }); app.setToast('Transaction added.'); onClose(); } catch (err) { app.fail(err); setBusy(false); }
  };
  const cats = f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <Modal title="Add transaction" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field-label" htmlFor="tx-title">Transaction name</label>
        <input id="tx-title" className="text-input" required autoFocus value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Groceries" />
        <div className="form-two">
          <div>
            <label className="field-label" htmlFor="tx-amount">Amount</label>
            <div className="amount-with-currency">
              <input id="tx-amount" className="text-input" type="number" min="0.01" step="0.01" required value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0.00" />
              <select className="text-input" aria-label="Currency" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="tx-type">Type</label>
            <select id="tx-type" className="text-input" value={f.type} onChange={e => setF({ ...f, type: e.target.value, category: e.target.value === 'income' ? 'Allowance' : 'Food' })}>
              <option value="expense">Expense</option><option value="income">Income</option>
            </select>
          </div>
        </div>
        {f.currency !== 'EUR' && Number(f.amount) > 0 && <p className="hint">Saved as {formatIn(amountEur, 'EUR')} at the {app.rates.source === 'live' ? 'current' : 'offline'} reference rate.</p>}
        <div className="form-two">
          <div>
            <label className="field-label" htmlFor="tx-cat">Category</label>
            <select id="tx-cat" className="text-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className="field-label" htmlFor="tx-date">Date</label>
            <input id="tx-date" className="text-input" type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          </div>
        </div>
        <label className="field-label" htmlFor="tx-note">Note (optional)</label>
        <input id="tx-note" className="text-input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Add a short note" />
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={busy}><Plus size={16} /> Save transaction</button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentModal({ app, onClose }) {
  const [f, setF] = useState({ title: '', amount: '', due: app.today, category: 'Utilities' });
  const submit = async e => {
    e.preventDefault();
    if (!f.title.trim() || !(Number(f.amount) > 0)) return;
    try { await app.addPayment({ ...f, title: f.title.trim(), amount: Number(f.amount) }); app.setToast('Payment reminder added.'); onClose(); } catch (err) { app.fail(err); }
  };
  return (
    <Modal title="Add payment reminder" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field-label" htmlFor="p-title">Payment name</label>
        <input id="p-title" className="text-input" autoFocus required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Tuition installment" />
        <div className="form-two">
          <div><label className="field-label" htmlFor="p-amount">Amount (€)</label><input id="p-amount" className="text-input" type="number" min="0.01" step="0.01" required value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></div>
          <div><label className="field-label" htmlFor="p-due">Due date</label><input id="p-due" className="text-input" type="date" required value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></div>
        </div>
        <label className="field-label" htmlFor="p-cat">Category</label>
        <select id="p-cat" className="text-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{PAYMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit"><Plus size={16} /> Add reminder</button>
        </div>
      </form>
    </Modal>
  );
}

export function BudgetModal({ app, onClose }) {
  const [b, setB] = useState(app.budget);
  const submit = async e => { e.preventDefault(); try { await app.saveBudget(b); app.setToast('Budget plan saved.'); onClose(); } catch (err) { app.fail(err); } };
  return (
    <Modal title="Edit monthly plan" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-two">
          <div><label className="field-label" htmlFor="b-inc">Planned monthly income (€)</label><input id="b-inc" className="text-input" type="number" min="0" step="1" value={b.income} onChange={e => setB({ ...b, income: Number(e.target.value) })} /></div>
          <div><label className="field-label" htmlFor="b-sav">Savings goal (€)</label><input id="b-sav" className="text-input" type="number" min="0" step="1" value={b.savingsGoal} onChange={e => setB({ ...b, savingsGoal: Number(e.target.value) })} /></div>
        </div>
        <h3 className="form-section-title">Category spending limits (€ per month)</h3>
        <div className="budget-edit-grid">
          {Object.entries(b.categoryLimits).map(([cat, limit]) => (
            <div key={cat}><label className="field-label" htmlFor={`lim-${cat}`}>{cat}</label><input id={`lim-${cat}`} className="text-input" type="number" min="0" step="1" value={limit} onChange={e => setB({ ...b, categoryLimits: { ...b.categoryLimits, [cat]: Number(e.target.value) } })} /></div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">Save budget</button>
        </div>
      </form>
    </Modal>
  );
}

export function ResetModal({ onConfirm, onClose }) {
  return (
    <Modal title="Reset sample workspace?" onClose={onClose}>
      <p className="modal-copy">This replaces the transactions, payments, budget, chat and activity log in your account with the sample workspace. This cannot be undone.</p>
      <div className="modal-actions">
        <button className="secondary-btn" onClick={onClose}>Cancel</button>
        <button className="primary-btn danger-primary" onClick={onConfirm}>Reset data</button>
      </div>
    </Modal>
  );
}
