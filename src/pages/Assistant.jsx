import React, { useEffect, useRef, useState } from 'react';
import { Bot, Sparkles, GraduationCap, Send, RefreshCw, ShieldCheck, CircleHelp, ArrowUpRight, Wrench, PauseCircle } from 'lucide-react';
import { PageHeading, ActionCard } from '../components/ui.jsx';

const TOOL_LABELS = {
  get_financial_summary: 'Read summary', list_upcoming_payments: 'Read payments', convert_currency: 'Convert currency',
  compare_transfer_options: 'Compare transfers', estimate_study_abroad_budget: 'Study budget', check_message_for_scam: 'Scam check',
  propose_add_transaction: 'Propose transaction', propose_payment_reminder: 'Propose reminder', propose_budget_limit: 'Propose limit', propose_savings_goal: 'Propose goal'
};
const PROMPTS = [
  'My parents send me 60000 lek every month. What is the cheapest way?',
  'I spent 5000 lek on books',
  'Cost of living to study in Milan with 700 eur a month',
  'Remind me to pay internet 15 on 2026-11-02',
  'Is this a scam: pay the deposit by Western Union today, I am abroad and keys will be sent',
  'Review my budget and suggest new limits'
];

export default function Assistant({ app }) {
  const { chat, api, agent } = app;
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const loading = chat.some(m => m.loading);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat.length, loading]);

  const submit = e => { e?.preventDefault(); if (!input.trim() || loading) return; app.sendToAgent(input); setInput(''); };
  const status = !agent.enabled ? ['status-off', 'Agent paused'] : api.status === 'ready' ? ['status-ready', 'Claude connected'] : api.status === 'demo' ? ['status-warn', 'Demo mode (no API key)'] : api.status === 'offline' ? ['status-off', 'Server offline'] : ['status-warn', 'Checking…'];

  return (
    <>
      <PageHeading live eyebrow="AI AS A FINANCIAL PARTICIPANT — WITH YOU IN CONTROL" title={<>AI agent <span className="ai-heading-mark"><Sparkles size={21} /></span></>} text="The agent uses tools to read your data, compare options and prepare changes. You approve every change.">
        <span className={`status-chip ${status[0]}`}><i />{status[1]}</span>
      </PageHeading>
      {!agent.enabled && <div className="notice warn-notice"><PauseCircle size={18} /><span>The agent is paused. It will not answer or propose changes until you turn it back on in <button className="link-btn" onClick={() => app.switchPage('settings')}>Settings → Agent controls</button>.</span></div>}
      <div className="chat-layout">
        <section className="panel chat-panel">
          <div className="chat-header">
            <div className="chat-avatar"><Bot size={22} /></div>
            <div><b>StudentFin AI agent</b><small><span className="live-dot" /> {api.mode === 'claude' ? `Claude · ${api.model}` : 'Rule-based demo planner'} · max {app.fmt(agent.maxActionAmount)} per action</small></div>
            <button className="icon-btn" onClick={() => app.setChat([app.WELCOME])} aria-label="Clear chat"><RefreshCw size={16} /></button>
          </div>
          <div className="chat-messages">
            {chat.map((m, i) => (
              <div key={i} className={`chat-message ${m.role === 'user' ? 'from-user' : 'from-ai'}`}>
                <div className="message-avatar">{m.role === 'user' ? <GraduationCap size={16} /> : <Sparkles size={16} />}</div>
                {m.loading ? <div className="typing"><i /><i /><i /></div> : (
                  <div className="message-body">
                    <div className="message-label">{m.role === 'user' ? 'You' : 'StudentFin AI'}{m.mode === 'demo' && <span className="mode-tag">demo</span>}</div>
                    {m.trace?.length > 0 && <div className="trace-chips">{m.trace.map((t, j) => <span key={j} className={`trace-chip t-${t.status}`}><Wrench size={11} /> {TOOL_LABELS[t.tool] || t.tool}{t.status === 'rejected_by_policy' ? ' · blocked by policy' : ''}</span>)}</div>}
                    <p className="pre-line">{m.content}</p>
                    {m.actions?.map(a => <ActionCard key={a.id} action={a} fmt={app.fmt} onApprove={() => app.decideAction(i, a.id, 'approved')} onReject={() => app.decideAction(i, a.id, 'rejected')} />)}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="chat-compose" onSubmit={submit}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask, or tell the agent what to do…" disabled={loading || !agent.enabled} aria-label="Message the agent" />
            <button className="send-btn" disabled={loading || !input.trim() || !agent.enabled} aria-label="Send message"><Send size={17} /></button>
          </form>
          <div className="chat-footnote"><ShieldCheck size={13} /> A short financial summary is sent to the server with each message. Never share passwords, card numbers or codes.</div>
        </section>
        <aside className="chat-side">
          <div className="panel prompt-panel">
            <h3><Sparkles size={16} /> Try asking</h3>
            {PROMPTS.map(q => <button key={q} onClick={() => setInput(q)}>{q}<ArrowUpRight size={14} /></button>)}
          </div>
          <div className="panel context-panel">
            <h3>How the agent stays safe</h3>
            <div><span>Read-only tools</span><b>run automatically</b></div>
            <div><span>Changes to your data</span><b>need approval</b></div>
            <div><span>Per-action limit</span><b>{app.fmt(agent.maxActionAmount)}</b></div>
            <div><span>Proposals per message</span><b>max 3</b></div>
            <div><span>Money movement</span><b>never</b></div>
            <small><button className="link-btn" onClick={() => app.switchPage('activity')}>See every tool call in the activity log →</button></small>
          </div>
          <div className="notice"><CircleHelp size={17} /><span>AI responses are educational, can be wrong, and are not professional financial advice.</span></div>
        </aside>
      </div>
    </>
  );
}
