import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, CreditCard, Bot, Settings, Search, Bell, ChevronDown,
  MoreHorizontal, Check, X, Menu, ShieldCheck, Landmark, Globe2, ShieldAlert, History, Plane, LogOut, User
} from 'lucide-react';
import { FALLBACK_EUR_RATES, convert } from '../shared/rates.js';
import { BUDGET_CATEGORIES } from '../shared/categories.js';
import { read, save, todayISO, formatMoney } from './lib/util.js';
import { computeAlerts } from './lib/alerts.js';
import { api, setUnauthorizedHandler } from './lib/api.js';
import { AlertList } from './components/ui.jsx';
import { TransactionModal, PaymentModal, BudgetModal, ResetModal } from './components/modals.jsx';
import AuthScreen from './pages/AuthScreen.jsx';
import Overview from './pages/Overview.jsx';
import Budget from './pages/Budget.jsx';
import Transactions from './pages/Transactions.jsx';
import Payments from './pages/Payments.jsx';
import Transfers from './pages/Transfers.jsx';
import StudyPlanner from './pages/StudyPlanner.jsx';
import ScamCheck from './pages/ScamCheck.jsx';
import Assistant from './pages/Assistant.jsx';
import Activity from './pages/Activity.jsx';
import SettingsPage from './pages/Settings.jsx';

const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, section: 'WORKSPACE' },
  { id: 'budget', label: 'My budget', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'transfers', label: 'Money across borders', icon: Globe2, section: 'CROSS-BORDER TOOLS' },
  { id: 'planner', label: 'Study abroad planner', icon: Plane },
  { id: 'scam', label: 'Scam check', icon: ShieldAlert },
  { id: 'assistant', label: 'AI agent', icon: Bot, accent: true, section: 'AI' },
  { id: 'activity', label: 'Agent activity log', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'PREFERENCES' }
];

const WELCOME = { role: 'assistant', content: 'Hi! I’m your StudentFin AI agent. I can compare ways to send money home or abroad, plan a study-abroad budget, check suspicious messages, and prepare changes to your budget — you approve every change before it is saved. What would you like to do?' };

export default function App() {
  const [session, setSession] = useState({ status: 'checking', user: null });
  const [health, setHealth] = useState(null);
  const [rates, setRates] = useState({ rates: FALLBACK_EUR_RATES, source: 'fallback', updated: null });

  useEffect(() => {
    setUnauthorizedHandler(() => setSession({ status: 'out', user: null }));
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ offline: true }));
    fetch('/api/rates').then(r => r.json()).then(r => { if (r?.rates) setRates(r); }).catch(() => {});
    api('/auth/me').then(r => setSession({ status: 'in', user: r.user })).catch(() => setSession({ status: 'out', user: null }));
  }, []);

  if (session.status === 'checking') return <div className="boot-screen"><div className="brand-mark"><Landmark size={22} /></div></div>;
  if (session.status === 'out') return <AuthScreen demo={health?.demoAccount} onAuthed={user => setSession({ status: 'in', user })} />;
  return <Workspace key={session.user.id} initialUser={session.user} health={health} rates={rates} setRates={setRates}
    onLogout={async () => { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ } setSession({ status: 'out', user: null }); }} />;
}

function Workspace({ initialUser, health, rates, setRates, onLogout }) {
  const [page, setPage] = useState('dashboard');
  const [user, setUser] = useState(initialUser);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const chatKey = `sfin_chat_${initialUser.id}`;
  const [chat, setChat] = useState(() => read(chatKey, [WELCOME]));
  const [modal, setModal] = useState('');
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  const refresh = async () => {
    const d = await api('/data');
    setUser(d.user); setTransactions(d.transactions); setPayments(d.payments); setActivity(d.activity);
    // Proposals that are no longer pending on the server are shown as expired in the chat.
    const pending = new Set(d.pendingProposals);
    setChat(c => c.map(m => m.actions ? { ...m, actions: m.actions.map(a => a.status === 'pending' && !pending.has(a.id) ? { ...a, status: 'expired' } : a) } : m));
    setLoaded(true);
  };
  useEffect(() => { refresh().catch(e => setToast(e.message)); }, []);
  useEffect(() => save(chatKey, chat.slice(-60)), [chat]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); } }, [toast]);

  const loadRates = () => fetch('/api/rates').then(r => r.json()).then(r => { if (r?.rates) setRates(r); }).catch(() => {});
  const fail = e => setToast(e.message || 'Something went wrong.');

  // ---- derived values (all stored amounts are EUR) ----
  const today = todayISO();
  const currency = user.currency;
  const profile = { name: user.name, email: user.email, country: user.country, studyCity: user.studyCity };
  const budget = user.budget;
  const agent = user.agent;
  const displayRate = rates.rates[currency] || 1;
  const displayCurrency = rates.rates[currency] ? currency : 'EUR';
  const fmt = n => formatMoney(n, displayCurrency, displayRate);
  const toEur = (amount, cur) => convert(amount, cur, 'EUR', rates.rates) ?? Number(amount);

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expenses;
  const categoryData = useMemo(() => Object.entries(
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {})
  ).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value), [transactions]);
  const upcomingPayments = payments.filter(p => !p.paid).sort((a, b) => a.due.localeCompare(b.due));
  const alerts = useMemo(() => computeAlerts({ transactions, payments, budget, today, balance }), [transactions, payments, budget, today, balance]);

  // ---- mutations: every change goes through the API and is stored in the database ----
  const addTransaction = async (t) => {
    const row = await api('/transactions', { method: 'POST', body: t });
    setTransactions(prev => [row, ...prev]);
    return row;
  };
  const deleteTransaction = async (id) => { await api(`/transactions/${id}`, { method: 'DELETE' }); setTransactions(prev => prev.filter(x => x.id !== id)); };
  const addPayment = async (p) => { const row = await api('/payments', { method: 'POST', body: p }); setPayments(prev => [...prev, row]); return row; };
  const togglePaid = async (p) => { const row = await api(`/payments/${p.id}`, { method: 'PATCH', body: { paid: !p.paid } }); setPayments(prev => prev.map(x => x.id === p.id ? row : x)); };
  const deletePayment = async (id) => { await api(`/payments/${id}`, { method: 'DELETE' }); setPayments(prev => prev.filter(x => x.id !== id)); };
  const saveBudget = async (b) => { const r = await api('/budget', { method: 'PUT', body: b }); setUser(r.user); };
  const saveProfile = async (patch) => { const r = await api('/profile', { method: 'PUT', body: patch }); setUser(r.user); };
  const saveAgent = async (a) => { const r = await api('/agent-settings', { method: 'PUT', body: a }); setUser(r.user); const d = await api('/data'); setActivity(d.activity); };
  const logActivity = async (entry) => { try { const row = await api('/activity', { method: 'POST', body: entry }); setActivity(a => [row, ...a]); } catch { /* best effort */ } };
  const clearActivity = async () => { await api('/activity', { method: 'DELETE' }); setActivity([]); };
  const importBackup = async (data) => { await api('/import', { method: 'POST', body: data }); await refresh(); };
  const resetAll = async () => {
    try { await api('/reset', { method: 'POST', body: {} }); setChat([WELCOME]); setModal(''); await refresh(); setToast('Sample workspace restored.'); } catch (e) { fail(e); }
  };

  // Approve / reject: the server applies the stored proposal, so the browser cannot change it.
  const decideAction = async (msgIndex, actionId, decision) => {
    const action = chat[msgIndex]?.actions?.find(x => x.id === actionId);
    if (!action || action.status !== 'pending') return;
    const setStatus = status => setChat(c => c.map((m, i) => i !== msgIndex ? m : { ...m, actions: m.actions.map(x => x.id === actionId ? { ...x, status } : x) }));
    try {
      await api(`/proposals/${actionId}/decision`, { method: 'POST', body: { decision } });
      setStatus(decision);
      setToast(decision === 'approved' ? 'Approved and saved.' : 'Proposal rejected. Nothing was changed.');
    } catch (e) {
      if (e.data?.status) setStatus(e.data.status === 'blocked' ? 'rejected' : e.data.status);
      fail(e);
    }
    await refresh().catch(() => {});
  };

  const sendToAgent = async (text) => {
    const message = text.trim();
    if (!message) return;
    const base = chat.map(m => m.actions ? { ...m, actions: m.actions.map(a => a.status === 'pending' ? { ...a, status: 'expired' } : a) } : m);
    const next = [...base, { role: 'user', content: message }];
    setChat([...next, { role: 'assistant', content: '', loading: true }]);
    try {
      const data = await api('/agent', { method: 'POST', body: { messages: next.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })) } });
      setChat([...next, { role: 'assistant', content: data.answer, actions: (data.actions || []).map(a => ({ ...a, status: 'pending' })), trace: data.trace || [], mode: data.mode }]);
      const d = await api('/data'); setActivity(d.activity);
    } catch (err) {
      setChat([...next, { role: 'assistant', content: `I couldn't complete that: ${err.message}`, error: true }]);
    }
  };
  const askAgent = (text) => { setPage('assistant'); setMobileNav(false); sendToAgent(text); };
  const switchPage = id => { setPage(id); setMobileNav(false); setBellOpen(false); setMenuOpen(false); };

  const api_ = { status: health?.offline ? 'offline' : health?.aiConfigured ? 'ready' : health ? 'demo' : 'checking', mode: health?.mode, model: health?.model };
  const app = {
    page, switchPage, user, transactions, payments, budget, currency, profile, agent, activity, chat, setChat,
    setModal, setToast, search, setSearch, api: api_, rates, loadRates, fmt, toEur, displayCurrency, today,
    income, expenses, balance, categoryData, upcomingPayments, alerts, addTransaction, deleteTransaction, addPayment,
    togglePaid, deletePayment, saveBudget, saveProfile, saveAgent, logActivity, clearActivity, importBackup,
    decideAction, sendToAgent, askAgent, resetAll, fail, WELCOME, BUDGET_CATEGORIES
  };

  const pageEl = !loaded ? <div className="empty-state">Loading your workspace…</div> : {
    dashboard: <Overview app={app} />, budget: <Budget app={app} />, transactions: <Transactions app={app} />,
    payments: <Payments app={app} />, transfers: <Transfers app={app} />, planner: <StudyPlanner app={app} />,
    scam: <ScamCheck app={app} />, assistant: <Assistant app={app} />, activity: <Activity app={app} />,
    settings: <SettingsPage app={app} />
  }[page];
  const pendingCount = chat.reduce((s, m) => s + (m.actions || []).filter(a => a.status === 'pending').length, 0);
  const initial = (profile.name || 'S').slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Landmark size={22} /></div>
          <div><b>StudentFin<span> AI</span></b><small>MONEY ACROSS BORDERS</small></div>
          <button className="mobile-close icon-btn" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="side-nav">
          {NAV.map(item => (
            <React.Fragment key={item.id}>
              {item.section && <div className="nav-section">{item.section}</div>}
              <button className={`nav-link ${page === item.id ? 'active' : ''} ${item.accent ? 'ai-nav' : ''}`} onClick={() => switchPage(item.id)}>
                <item.icon size={18} /><span>{item.label}</span>
                {item.accent && <span className="new-pill">{pendingCount ? `${pendingCount} to review` : 'AI'}</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar">{initial}</div>
            <div className="user-meta"><b>{profile.name || 'Student'}</b><small>{profile.country} · {displayCurrency}</small></div>
            <button className="icon-btn" onClick={() => switchPage('settings')} aria-label="Settings"><MoreHorizontal size={18} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{NAV.find(n => n.id === page)?.label}</b></div>
          </div>
          <div className="topbar-actions">
            <div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." onKeyDown={e => { if (e.key === 'Enter') switchPage('transactions'); }} /></div>
            <div className="bell-wrap">
              <button className="icon-btn notification-btn" onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} aria-label={`Alerts (${alerts.length})`}><Bell size={18} />{alerts.some(a => a.level !== 'info') && <i />}</button>
              {bellOpen && (
                <div className="bell-panel">
                  <div className="bell-head"><b>Alerts</b><button className="icon-btn" onClick={() => setBellOpen(false)} aria-label="Close alerts"><X size={15} /></button></div>
                  <AlertList alerts={alerts} onOpen={switchPage} />
                </div>
              )}
            </div>
            <div className="bell-wrap">
              <button className="top-user" onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} aria-haspopup="menu" aria-expanded={menuOpen}>
                <div className="user-avatar small">{initial}</div><span>{profile.name || 'Student'}</span><ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="bell-panel user-menu" role="menu">
                  <div className="user-menu-head"><div className="user-avatar">{initial}</div><div><b>{profile.name}</b><small>{profile.email}</small>{user.isDemo && <span className="mode-tag">demo account</span>}</div></div>
                  <button role="menuitem" onClick={() => switchPage('settings')}><User size={15} /> Profile & settings</button>
                  <button role="menuitem" className="danger-item" onClick={onLogout}><LogOut size={15} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-content">{pageEl}</div>
        <footer className="footer">
          <span>© 2026 StudentFin AI</span>
          <span><ShieldCheck size={13} /> The agent proposes, you decide. No bank access, no payments.</span>
          <span>Educational use only · not financial advice</span>
        </footer>
      </main>

      {modal === 'transaction' && <TransactionModal app={app} onClose={() => setModal('')} />}
      {modal === 'payment' && <PaymentModal app={app} onClose={() => setModal('')} />}
      {modal === 'budget' && <BudgetModal app={app} onClose={() => setModal('')} />}
      {modal === 'reset' && <ResetModal onConfirm={resetAll} onClose={() => setModal('')} />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={14} /></button></div>}
    </div>
  );
}
