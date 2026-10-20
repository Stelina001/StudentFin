import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Bot, Search } from 'lucide-react';
import { PageHeading } from '../components/ui.jsx';
import { scamCheck } from '../../shared/scam.js';

const EXAMPLES = [
  { label: 'Rental listing', text: 'Hello! The room near the university is still available, 350€/month. I am currently abroad so I cannot show you the flat, but the keys will be sent by courier. Please pay the deposit of 700€ by Western Union today to reserve it, many students are interested.' },
  { label: 'Scholarship email', text: 'Congratulations! You have been selected for the International Excellence Scholarship of €5,000. To release the funds, pay a processing fee of €95 within 24 hours via this link: bit.ly/schol-pay. Contact the scholarship committee on WhatsApp.' },
  { label: 'Bank SMS', text: 'Your bank account will be suspended. Reply with the verification code we just sent you and your card number to keep it active.' },
  { label: 'Normal message', text: 'Hi, this is Ana from the student housing office. Your contract is ready to sign at our office on Monday between 9 and 12. Please bring your passport.' }
];

export default function ScamCheck({ app }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const run = (t = text) => {
    const r = scamCheck(t);
    setResult(r);
    if (!r.error) app.logActivity({ actionType: 'scam_check', params: { level: r.level, score: r.score, signals: r.signals.map(s => s.id) }, status: 'checked', reason: 'Scam check run by user' });
  };
  const meterCls = result?.level === 'high' ? 'bad' : result?.level === 'medium' ? 'warn' : 'good';

  return (
    <>
      <PageHeading eyebrow="STAY SAFE ABROAD" title="Scam check" text="Paste a rental listing, job offer, scholarship email or bank message. We explain every warning sign we find." />
      <div className="planner-layout">
        <section className="panel pad-panel">
          <div className="panel-head"><div><h2><Search size={16} className="inline-icon" /> Message to check</h2><p>Runs in your browser; nothing is sent unless you ask the agent.</p></div></div>
          <div className="preset-row tight">{EXAMPLES.map(e => <button key={e.label} className="preset" onClick={() => { setText(e.text); run(e.text); }}>{e.label}</button>)}</div>
          <textarea className="text-input text-area" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder="Paste the message here…" aria-label="Message to check" />
          <div className="heading-actions plan-actions">
            <button className="primary-btn" onClick={() => run()} disabled={!text.trim()}><ShieldAlert size={15} /> Check for scam signals</button>
            <button className="secondary-btn" disabled={!text.trim()} onClick={() => app.askAgent(`Is this a scam? Please explain the warning signs and what I should do:\n\n"${text.slice(0, 2000)}"`)}><Bot size={15} /> Second opinion from agent</button>
          </div>
        </section>
        <section className="panel pad-panel">
          <div className="panel-head"><div><h2>Result</h2><p>Rule-based, explainable signals</p></div></div>
          {!result && <div className="empty-state">Paste a message or try one of the examples.</div>}
          {result?.error && <div className="error-note">{result.error}</div>}
          {result && !result.error && <>
            <div className={`risk-meter ${meterCls}`}>
              {result.level === 'low' ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}
              <div><b>{result.level.toUpperCase()} RISK</b><small>{result.score}/10 · {result.signals.length} warning sign{result.signals.length === 1 ? '' : 's'}</small></div>
              <div className="risk-track"><div style={{ width: `${result.score * 10}%` }} /></div>
            </div>
            <div className="signal-list">
              {result.signals.map(s => (
                <div className="signal" key={s.id}><b>{s.label} <span className="category-pill">“{s.excerpt}”</span></b><small>{s.why}</small></div>
              ))}
            </div>
            <div className={`plan-status ${meterCls}`}>{result.advice}</div>
          </>}
          <p className="disclaimer">This tool flags common patterns. It cannot prove a message is safe. When in doubt, contact the organisation through its official website or phone number.</p>
        </section>
      </div>
    </>
  );
}
