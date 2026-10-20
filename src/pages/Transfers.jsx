import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, RefreshCw, Trophy, Info, Bot, Plus, ShieldCheck } from 'lucide-react';
import { PageHeading } from '../components/ui.jsx';
import { CURRENCIES, convert } from '../../shared/rates.js';
import { compareTransfers } from '../../shared/transfers.js';
import { formatIn } from '../lib/util.js';

const PRESETS = [
  { label: 'Family in Albania → student in Italy', amount: 60000, from: 'ALL', to: 'EUR' },
  { label: 'Student in Germany → family in Albania', amount: 200, from: 'EUR', to: 'ALL' },
  { label: 'Parents in UK → student in Tirana', amount: 300, from: 'GBP', to: 'ALL' },
  { label: 'Work in Switzerland → home in Kosovo', amount: 500, from: 'CHF', to: 'EUR' }
];

export default function Transfers({ app }) {
  const [amount, setAmount] = useState('60000');
  const [from, setFrom] = useState('ALL');
  const [to, setTo] = useState('EUR');
  const [chosen, setChosen] = useState(null);
  const result = useMemo(() => compareTransfers(Number(amount), from, to, app.rates.rates), [amount, from, to, app.rates]);
  const ok = !result.error;
  const best = ok ? result.options[0] : null;

  const recordFee = (o) => {
    const feeEur = convert(o.totalCost, from, 'EUR', app.rates.rates);
    app.addTransaction({ title: `Transfer cost (${o.provider})`.slice(0, 80), amount: Math.round(feeEur * 100) / 100, type: 'expense', category: 'Transfers', date: app.today, note: `${formatIn(amount, from)} → ${to}`, originalAmount: o.totalCost, originalCurrency: from })
      .then(() => app.setToast('Transfer cost recorded as an expense.')).catch(app.fail);
  };

  return (
    <>
      <PageHeading live eyebrow="MONEY WITHOUT BORDERS" title="Money across borders" text="Compare what the recipient really gets after fees and exchange-rate margins.">
        <span className="live-badge"><span className="live-dot" /> {app.rates.source === 'live' ? 'Live reference rates' : 'Offline rate estimates'}</span>
      </PageHeading>

      <div className="preset-row">{PRESETS.map(p => (
        <button key={p.label} className={`preset ${amount == p.amount && from === p.from && to === p.to ? 'selected' : ''}`} onClick={() => { setAmount(String(p.amount)); setFrom(p.from); setTo(p.to); setChosen(null); }}>{p.label}</button>
      ))}</div>

      <section className="transfer-layout">
        <div className="panel converter-panel">
          <div className="converter-title"><div className="round-icon"><ArrowLeftRight size={20} /></div><div><h2>Transfer calculator</h2><p>Reference mid-market rate, then each provider’s fees.</p></div></div>
          <label className="field-label" htmlFor="tr-amount">Sender pays</label>
          <div className="currency-input">
            <input id="tr-amount" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
            <select aria-label="From currency" value={from} onChange={e => setFrom(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <button className="swap-btn" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap currencies"><ArrowLeftRight size={17} /></button>
          <label className="field-label">Recipient currency</label>
          <div className="currency-input result-input">
            <div className="result-amount">{ok ? formatIn(best.received, to) : '—'}</div>
            <select aria-label="To currency" value={to} onChange={e => setTo(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          {ok && <div className="rate-note"><Info size={15} /> 1 {from} = {result.midRate} {to} mid-market{app.rates.updated ? ` · updated ${new Date(app.rates.updated).toLocaleDateString('en-GB')}` : ''}</div>}
          {!ok && <div className="error-note">{result.error}</div>}
          <button className="secondary-btn full-btn" onClick={app.loadRates}><RefreshCw size={15} /> Refresh rates</button>
          <p className="disclaimer">Providers are illustrative types with typical published fee ranges, not quotes. Always confirm the final amount with the provider before sending.</p>
        </div>

        <div className="panel pad-panel">
          <div className="panel-head">
            <div><h2>Compare options</h2><p>Best value first · costs include fees and FX margin</p></div>
            {ok && <span className="save-pill"><Trophy size={14} /> Save {formatIn(result.savingsVsWorst, to)}</span>}
          </div>
          {ok && (
            <div className="provider-list">
              {result.options.map((o, i) => (
                <div key={o.id} className={`provider-row ${i === 0 ? 'best' : ''} ${chosen === o.id ? 'chosen' : ''}`}>
                  <div className="provider-main">
                    <b>{i === 0 && <span className="best-tag">Best value</span>}{o.provider}</b>
                    <small>{o.speed} · fee {formatIn(o.fee, from)} · FX margin {(o.fxMargin * 100).toFixed(1)}%</small>
                    <small className="muted">{o.note}</small>
                  </div>
                  <div className="provider-nums">
                    <b>{formatIn(o.received, to)}</b>
                    <small className={o.costPct > 3 ? 'negative' : 'positive'}>cost {formatIn(o.totalCost, from)} ({o.costPct}%)</small>
                  </div>
                  <button className="icon-btn" title="Record this transfer cost as an expense" aria-label={`Record cost for ${o.provider}`} onClick={() => { setChosen(o.id); recordFee(o); }}><Plus size={16} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="agent-cta">
            <Bot size={18} />
            <span>Not sure? The agent can explain the trade-offs for your situation.</span>
            <button className="secondary-btn" onClick={() => app.askAgent(`I need to send ${amount} ${from} to someone who receives ${to}. Compare the options and tell me the best choice and what to watch out for.`)}>Ask the agent</button>
          </div>
        </div>
      </section>
      <div className="notice"><ShieldCheck size={18} /><span>StudentFin AI never sends money. It helps you choose; you complete the transfer with the provider you trust.</span></div>
    </>
  );
}
