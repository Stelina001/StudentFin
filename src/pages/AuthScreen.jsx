import React, { useState } from 'react';
import { Landmark, LogIn, UserPlus, Sparkles, ShieldCheck, Globe2, Plane, ShieldAlert, Bot } from 'lucide-react';
import { api } from '../lib/api.js';

export default function AuthScreen({ onAuthed, demo }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { const r = await fn(); onAuthed(r.user); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const submit = e => {
    e.preventDefault();
    run(() => mode === 'login'
      ? api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } })
      : api('/auth/register', { method: 'POST', body: f }));
  };

  return (
    <div className="auth-shell">
      <section className="auth-intro">
        <div className="brand"><div className="brand-mark"><Landmark size={22} /></div><div><b>StudentFin<span> AI</span></b><small>MONEY ACROSS BORDERS</small></div></div>
        <h1>Your AI money agent for studying and living across borders.</h1>
        <p>Compare transfers home, plan a study-abroad budget, spot scams — and let an AI agent prepare changes that you approve.</p>
        <ul className="auth-points">
          <li><Globe2 size={17} /> Cheapest way to send money between countries</li>
          <li><Plane size={17} /> Real monthly cost of 15 student cities</li>
          <li><ShieldAlert size={17} /> Explainable scam detection</li>
          <li><Bot size={17} /> AI agent that proposes — you decide</li>
        </ul>
        <div className="notice"><ShieldCheck size={17} /><span>Passwords are hashed with bcrypt. Sessions use secure, http-only cookies. The app never connects to your bank or moves money.</span></div>
      </section>

      <section className="panel auth-card">
        <div className="filter-tabs auth-tabs">
          <button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
          <button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="muted small-text">{mode === 'login' ? 'Log in to your StudentFin workspace.' : 'Your new workspace starts with sample data you can edit or reset.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <>
            <label className="field-label" htmlFor="a-name">Full name</label>
            <input id="a-name" className="text-input" autoComplete="name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Stella Leka" />
          </>}
          <label className="field-label" htmlFor="a-email">Email</label>
          <input id="a-email" className="text-input" type="email" autoComplete="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="you@university.edu" />
          <label className="field-label" htmlFor="a-pass">Password</label>
          <input id="a-pass" className="text-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} />
          {error && <div className="error-note">{error}</div>}
          <button className="primary-btn full-btn auth-submit" disabled={busy}>{mode === 'login' ? <><LogIn size={16} /> Log in</> : <><UserPlus size={16} /> Create account</>}</button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <button className="secondary-btn full-btn" disabled={busy} onClick={() => run(() => api('/auth/demo', { method: 'POST', body: {} }))}><Sparkles size={15} /> Explore the demo account</button>
        {demo && <p className="hint center">Demo login: <b>{demo.email}</b> / <b>{demo.password}</b></p>}
      </section>
    </div>
  );
}
