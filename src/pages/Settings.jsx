import React, { useRef, useState } from 'react';
import { GraduationCap, ShieldCheck, Bot, Download, Upload, RefreshCw, Database } from 'lucide-react';
import { PageHeading, Toggle } from '../components/ui.jsx';
import { CURRENCIES } from '../../shared/rates.js';
import { CITIES } from '../../shared/cities.js';
import { downloadFile } from '../lib/util.js';

const COUNTRIES = ['Albania', 'Kosovo', 'North Macedonia', 'Montenegro', 'Serbia', 'Bosnia and Herzegovina', 'Italy', 'Germany', 'Greece', 'United Kingdom', 'Other'];

export default function SettingsPage({ app }) {
  const { profile, agent, api, user } = app;
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: profile.name, country: profile.country, studyCity: profile.studyCity, currency: app.currency });
  const [limit, setLimit] = useState(agent.maxActionAmount);

  const saveProfile = async e => {
    e.preventDefault();
    try { await app.saveProfile(form); app.setToast('Profile saved.'); } catch (err) { app.fail(err); }
  };
  const saveLimit = async () => {
    const v = Math.min(5000, Math.max(1, Number(limit) || 1));
    setLimit(v);
    if (v !== agent.maxActionAmount) { try { await app.saveAgent({ ...agent, maxActionAmount: v }); app.setToast(`Per-action limit set to €${v}.`); } catch (err) { app.fail(err); } }
  };

  const exportAll = () => downloadFile('studentfin-backup.json', JSON.stringify({
    version: 3, exportedAt: new Date().toISOString(), profile, budget: app.budget, transactions: app.transactions, payments: app.payments, agent, currency: app.currency
  }, null, 2), 'application/json');

  const importAll = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.transactions) || !Array.isArray(data.payments)) throw new Error('Not a StudentFin backup');
      await app.importBackup({ transactions: data.transactions, payments: data.payments, budget: data.budget });
      app.setToast('Backup imported.');
    } catch (e) { app.setToast(`Could not import that file: ${e.message}`); }
  };

  return (
    <>
      <PageHeading eyebrow="MAKE IT YOURS" title="Settings" text="Profile, currency, agent permissions and your data." />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="settings-title"><div className="settings-icon"><GraduationCap size={19} /></div><div><h2>Personal profile</h2><p>{profile.email}{user.isDemo ? ' · shared demo account' : ''}</p></div></div>
          <form onSubmit={saveProfile}>
            <label className="field-label" htmlFor="s-name">Display name</label>
            <input id="s-name" className="text-input" required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            <label className="field-label" htmlFor="s-country">Home country</label>
            <select id="s-country" className="text-input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>
            <label className="field-label" htmlFor="s-city">City where you study (or plan to)</label>
            <select id="s-city" className="text-input" value={form.studyCity} onChange={e => setForm({ ...form, studyCity: e.target.value })}>{CITIES.map(c => <option key={c.id} value={c.id}>{c.city}</option>)}</select>
            <label className="field-label" htmlFor="s-cur">Display currency (amounts are stored in EUR)</label>
            <select id="s-cur" className="text-input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
            {form.currency !== 'EUR' && <p className="hint">Converted at {app.rates.source === 'live' ? 'live reference' : 'offline estimate'} rate: 1 EUR = {app.rates.rates[form.currency]} {form.currency}</p>}
            <button className="primary-btn settings-save" type="submit">Save preferences</button>
          </form>
        </section>

        <section className="panel settings-panel">
          <div className="settings-title"><div className="settings-icon"><Bot size={19} /></div><div><h2>Agent controls</h2><p>Decide what the AI agent is allowed to do.</p></div></div>
          <div className="setting-line">
            <div><b>Agent enabled</b><small>Pause to stop the agent answering or proposing anything (kill switch).</small></div>
            <Toggle checked={agent.enabled} label="Agent enabled" onChange={v => app.saveAgent({ ...agent, enabled: v }).then(() => app.setToast(v ? 'Agent enabled.' : 'Agent paused.')).catch(app.fail)} />
          </div>
          <div className="setting-line">
            <div><b>Per-action limit (€)</b><small>The server rejects any proposed transaction or reminder above this amount, and re-checks it when you approve.</small></div>
            <input className="text-input small-input" type="number" min="1" max="5000" value={limit} onChange={e => setLimit(e.target.value)} onBlur={saveLimit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Per-action limit" />
          </div>
          <div className="setting-line">
            <div><b>Human approval for every change</b><small>Always on. Proposals are stored on the server and applied only after you approve.</small></div>
            <span className="status-chip status-ready"><i />Always required</span>
          </div>
          <div className="setting-line">
            <div><b>AI service</b><small>{api.status === 'ready' ? `Claude (${api.model}) configured on the server.` : api.status === 'demo' ? 'No API key: the built-in demo planner is used.' : 'Could not reach the API server.'}</small></div>
            <span className={`status-chip ${api.status === 'ready' ? 'status-ready' : 'status-warn'}`}><i />{api.status === 'ready' ? 'Claude' : api.status === 'demo' ? 'Demo' : 'Offline'}</span>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-title"><div className="settings-icon mint"><Database size={19} /></div><div><h2>Data & privacy</h2><p>Your data is stored in your account on the server.</p></div></div>
          <div className="setting-line"><div><b>Export backup</b><small>Download all your data as a JSON file.</small></div><button className="secondary-btn" onClick={exportAll}><Download size={15} /> Export</button></div>
          <div className="setting-line"><div><b>Import backup</b><small>Replace your transactions and payments from a backup.</small></div><button className="secondary-btn" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e => { if (e.target.files[0]) importAll(e.target.files[0]); e.target.value = ''; }} /></div>
          <div className="setting-line"><div><b>Reset to sample data</b><small>Restore the sample workspace for this account.</small></div><button className="secondary-btn" onClick={() => app.setModal('reset')}><RefreshCw size={15} /> Reset</button></div>
          <div className="security-note"><ShieldCheck size={17} /><p>Passwords are hashed with bcrypt and never stored in plain text. Your session is an http-only cookie. Every request is checked so you can only see and change your own data.</p></div>
        </section>
      </div>
    </>
  );
}
