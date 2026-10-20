import React, { useState } from 'react';
import { Plus, Download, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { PageHeading, StatCard, TransactionTable } from '../components/ui.jsx';
import { downloadFile } from '../lib/util.js';

export default function Transactions({ app }) {
  const { fmt, transactions, income, expenses, balance, search } = app;
  const [filterType, setFilterType] = useState('all');
  const filtered = transactions
    .filter(t => (filterType === 'all' || t.type === filterType) && `${t.title} ${t.category} ${t.note || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const exportCsv = () => {
    const rows = [['Date', 'Title', 'Type', 'Category', 'Amount (EUR)', 'Original amount', 'Original currency', 'Source', 'Note'],
      ...transactions.map(t => [t.date, t.title, t.type, t.category, t.amount, t.originalAmount ?? t.amount, t.originalCurrency || 'EUR', t.source || 'manual', t.note || ''])];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    downloadFile('studentfin-transactions.csv', csv, 'text/csv;charset=utf-8;');
  };

  return (
    <>
      <PageHeading eyebrow="YOUR MONEY MOVES" title="Transactions" text="Every income and expense, in any currency — stored in EUR.">
        <button className="secondary-btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>
        <button className="primary-btn" onClick={() => app.setModal('transaction')}><Plus size={17} /> Add transaction</button>
      </PageHeading>
      <div className="stat-grid compact-stats">
        <StatCard label="All recorded income" value={fmt(income)} icon={TrendingUp} tone="mint" sub="all time in this workspace" />
        <StatCard label="All recorded expenses" value={fmt(expenses)} icon={TrendingDown} tone="rose" sub="all time in this workspace" />
        <StatCard label="Net balance" value={fmt(balance)} icon={Wallet} tone="violet" sub="income less expenses" />
      </div>
      <section className="panel transactions-panel">
        <div className="filter-bar">
          <div className="filter-tabs">{[['all', 'All activity'], ['income', 'Income'], ['expense', 'Expenses']].map(([id, label]) => <button key={id} className={filterType === id ? 'selected' : ''} onClick={() => setFilterType(id)}>{label}</button>)}</div>
          <span className="muted small-text">{filtered.length} records{search && ` matching “${search}”`}</span>
        </div>
        <TransactionTable fmt={fmt} transactions={filtered} onDelete={id => app.deleteTransaction(id).then(() => app.setToast('Transaction removed.')).catch(app.fail)} emptyText="No transactions match your search." />
      </section>
    </>
  );
}
