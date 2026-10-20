import React, { useMemo } from 'react';
import { Plus, Wallet, TrendingUp, TrendingDown, PiggyBank, CalendarDays, ArrowUpRight, Sparkles, Globe2, Plane, ShieldAlert, Bell } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { StatCard, TransactionTable, AlertList, PageHeading } from '../components/ui.jsx';

export const COLORS = ['#8b7cff', '#4ed5bd', '#f6bd60', '#ff7a90', '#64a8ff', '#b4a0ff', '#91a5b5', '#e59cff', '#7fd36b'];

export default function Overview({ app }) {
  const { fmt, transactions, income, expenses, balance, budget, categoryData, alerts, today } = app;
  const month = today.slice(0, 7);
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const chartData = useMemo(() => {
    const buckets = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 31]];
    return buckets.map(([a, b]) => ({
      day: `${String(a).padStart(2, '0')}–${String(b).padStart(2, '0')}`,
      amount: transactions.filter(t => t.type === 'expense' && t.date.slice(0, 7) === month && Number(t.date.slice(-2)) >= a && Number(t.date.slice(-2)) <= b)
        .reduce((s, t) => s + Number(t.amount), 0) * (app.rates.rates[app.displayCurrency] || 1)
    }));
  }, [transactions, month, app.displayCurrency, app.rates]);
  const transferFees = transactions.filter(t => t.category === 'Transfers').reduce((s, t) => s + Number(t.amount), 0);
  const fmtDisplay = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: app.displayCurrency, maximumFractionDigits: 2 }).format(v);

  return (
    <>
      <PageHeading live eyebrow="YOUR FINANCIAL SNAPSHOT" title={<>Good to see you, {app.profile.name || 'Student'} <span className="wave">✦</span></>} text="Here’s what’s happening with your money, at home and across borders.">
        <button className="primary-btn" onClick={() => app.setModal('transaction')}><Plus size={17} /> Add transaction</button>
      </PageHeading>

      <div className="stat-grid">
        <StatCard label="Current balance" value={fmt(balance)} good={balance >= 0} change={balance >= 0 ? 'Healthy balance' : 'Review spending'} sub="income minus expenses" icon={Wallet} tone="violet" />
        <StatCard label="Total income" value={fmt(income)} good change="Recorded" sub="from your transactions" icon={TrendingUp} tone="mint" />
        <StatCard label="Total expenses" value={fmt(expenses)} good={income > 0 && expenses / income < 0.8} change={`${income ? Math.round(expenses / income * 100) : 0}% of income`} sub="across all categories" icon={TrendingDown} tone="rose" />
        <StatCard label="Savings target" value={fmt(budget.savingsGoal)} good={balance >= budget.savingsGoal} change={balance >= budget.savingsGoal ? 'Goal reached' : 'Keep going'} sub={`${Math.max(0, Math.round(balance / Math.max(1, budget.savingsGoal) * 100))}% of target`} icon={PiggyBank} tone="amber" />
      </div>

      <div className="overview-split">
        <section className="panel pad-panel">
          <div className="panel-head"><div><h2><Bell size={16} className="inline-icon" /> Alerts</h2><p>Things that need your attention</p></div><span className="count-pill">{alerts.length}</span></div>
          <AlertList alerts={alerts} onOpen={app.switchPage} limit={4} />
        </section>
        <section className="panel pad-panel quick-panel">
          <div className="panel-head"><div><h2><Sparkles size={16} className="inline-icon" /> Cross-border tools</h2><p>Built for students who study or get money from abroad</p></div></div>
          <div className="quick-grid">
            <button onClick={() => app.switchPage('transfers')}><Globe2 size={18} /><b>Compare transfers</b><small>Find the cheapest way to send money home or abroad</small></button>
            <button onClick={() => app.switchPage('planner')}><Plane size={18} /><b>Plan study abroad</b><small>Monthly cost of 15 student cities vs your income</small></button>
            <button onClick={() => app.switchPage('scam')}><ShieldAlert size={18} /><b>Check a message</b><small>Spot rental, job and scholarship scams</small></button>
          </div>
          {transferFees > 0 && <p className="hint">You have paid {fmt(transferFees)} in transfer fees. <button className="link-btn" onClick={() => app.askAgent('How can I reduce the fees on the money my family sends me each month?')}>Ask the agent how to cut this</button></p>}
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel spending-panel">
          <div className="panel-head"><div><h2>Spending activity</h2><p>Recorded expenses this month</p></div><span className="select-wrap"><CalendarDays size={14} /><span>{monthName}</span></span></div>
          <div className="chart-legend"><span><i className="legend-dot purple" />Expenses</span><span className="chart-total">{fmtDisplay(chartData.reduce((s, x) => s + x.amount, 0))} <small>this month</small></span></div>
          <div className="area-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs><linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity={0.28} /><stop offset="95%" stopColor="#8b7cff" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#252a38" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#81899d', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#81899d', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#171b27', border: '1px solid #303548', borderRadius: 10, color: '#fff' }} formatter={v => [fmtDisplay(v), 'Expenses']} />
                <Area type="monotone" dataKey="amount" stroke="#9b8cff" strokeWidth={2.5} fill="url(#spendGradient)" activeDot={{ r: 5, fill: '#9b8cff', stroke: '#171b27', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot"><span><span className="tiny-line" />Tracked transactions only</span><span>Amounts in {app.displayCurrency}</span></div>
        </section>
        <section className="panel category-panel">
          <div className="panel-head"><div><h2>Where it goes</h2><p>Expense breakdown by category</p></div><button className="icon-btn" onClick={() => app.switchPage('transactions')} aria-label="View transactions"><ArrowUpRight size={17} /></button></div>
          {categoryData.length ? <>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={85} paddingAngle={3} stroke="none">{categoryData.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}</Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: '#171b27', border: '1px solid #303548', borderRadius: 10 }} /></PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><b>{fmt(expenses)}</b><small>spent</small></div>
            </div>
            <div className="category-legend">{categoryData.slice(0, 5).map((d, i) => <div className="category-row" key={d.name}><span className="category-name"><i style={{ background: COLORS[i % COLORS.length] }} />{d.name}</span><b>{fmt(d.value)}</b><small>{expenses ? Math.round(d.value / expenses * 100) : 0}%</small></div>)}</div>
          </> : <div className="empty-state">Add expenses to see your spending breakdown.</div>}
        </section>
      </div>

      <section className="panel transactions-panel">
        <div className="panel-head"><div><h2>Recent transactions</h2><p>Your latest money activity</p></div><button className="text-btn" onClick={() => app.switchPage('transactions')}>View all <ArrowUpRight size={15} /></button></div>
        <TransactionTable fmt={fmt} transactions={transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)} onDelete={id => app.deleteTransaction(id).catch(app.fail)} />
      </section>
    </>
  );
}
