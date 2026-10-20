import React, { useMemo, useState } from 'react';
import { Plane, Bot, Check, AlertTriangle } from 'lucide-react';
import { PageHeading } from '../components/ui.jsx';
import { CITIES, studyPlan } from '../../shared/cities.js';
import { COLORS } from './Overview.jsx';

const LABELS = { rent: 'Rent', food: 'Food', transport: 'Transport', utilities: 'Utilities & phone', insurance: 'Health insurance', other: 'Other / personal' };
// Planner cost keys → budget categories
const TO_BUDGET = { rent: 'Housing', food: 'Food', transport: 'Transport', utilities: 'Utilities', insurance: 'Health', other: 'Other' };

export default function StudyPlanner({ app }) {
  const [f, setF] = useState({ cityId: app.profile.studyCity || 'milan', months: 10, family: 500, scholarship: 200, partTimeHourly: 9, partTimeHours: 10, flights: 300, deposit: 600, visa: 120, setup: 200, bufferPct: 10 });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const plan = useMemo(() => studyPlan({
    cityId: f.cityId, months: f.months, bufferPct: f.bufferPct,
    incomes: { family: f.family, scholarship: f.scholarship, partTimeHourly: f.partTimeHourly, partTimeHours: f.partTimeHours },
    oneOff: { flights: f.flights, deposit: f.deposit, visa: f.visa, setup: f.setup }
  }), [f]);
  const fmt = app.fmt;
  const maxCost = Math.max(...plan.breakdown.map(b => b.amount));
  const num = (k, label, step = 1) => (
    <div><label className="field-label" htmlFor={`sp-${k}`}>{label}</label><input id={`sp-${k}`} className="text-input" type="number" min="0" step={step} value={f[k]} onChange={e => set(k, Number(e.target.value))} /></div>
  );

  const applyBudget = () => {
    const limits = { ...app.budget.categoryLimits };
    plan.breakdown.forEach(b => { limits[TO_BUDGET[b.key]] = b.amount; });
    app.saveBudget({ ...app.budget, income: plan.monthlyIncome, categoryLimits: limits }).then(() => {
      app.logActivity({ actionType: 'apply_study_plan', params: { city: plan.city, monthlyIncome: plan.monthlyIncome }, status: 'applied', reason: 'Applied from Study abroad planner' });
      app.setToast(`Budget updated with the ${plan.city} plan.`);
    }).catch(app.fail);
  };

  const statusText = {
    covered: { cls: 'good', icon: Check, text: 'Your income covers monthly costs and one-off expenses.' },
    'one-off-gap': { cls: 'warn', icon: AlertTriangle, text: 'Monthly costs are covered, but you need savings for the one-off costs.' },
    'monthly-gap': { cls: 'bad', icon: AlertTriangle, text: 'Your monthly income does not cover estimated monthly costs.' }
  }[plan.status];

  return (
    <>
      <PageHeading eyebrow="PLAN BEFORE YOU GO" title="Study abroad planner" text="Estimate the real monthly cost of studying in 15 student cities and see if your income covers it." />
      <div className="planner-layout">
        <section className="panel pad-panel">
          <div className="panel-head"><div><h2><Plane size={16} className="inline-icon" /> Your plan</h2><p>All amounts in EUR</p></div></div>
          <label className="field-label" htmlFor="sp-city">City</label>
          <select id="sp-city" className="text-input" value={f.cityId} onChange={e => { set('cityId', e.target.value); app.saveProfile({ studyCity: e.target.value }).catch(() => {}); }}>
            {CITIES.map(c => <option key={c.id} value={c.id}>{c.city}, {c.country}</option>)}
          </select>
          <div className="form-two">{num('months', 'Months of study')}{num('bufferPct', 'Safety buffer (%)')}</div>
          <h3 className="form-section-title">Monthly income</h3>
          <div className="form-two">{num('family', 'Family support')}{num('scholarship', 'Scholarship')}</div>
          <div className="form-two">{num('partTimeHourly', 'Part-time pay per hour', 0.5)}{num('partTimeHours', 'Part-time hours per week')}</div>
          <h3 className="form-section-title">One-off costs</h3>
          <div className="form-two">{num('flights', 'Flights')}{num('deposit', 'Rent deposit')}</div>
          <div className="form-two">{num('visa', 'Visa / residence permit')}{num('setup', 'Setup (bedding, SIM, books)')}</div>
        </section>

        <section className="panel pad-panel">
          <div className="panel-head"><div><h2>{plan.city}, {plan.country}</h2><p>Indicative student costs per month</p></div></div>
          <div className="plan-kpis">
            <div><span>Monthly cost</span><b>{fmt(plan.monthlyCost)}</b><small>incl. {fmt(plan.buffer)} buffer</small></div>
            <div><span>Monthly income</span><b>{fmt(plan.monthlyIncome)}</b><small>{plan.partTimeIncome ? `incl. ${fmt(plan.partTimeIncome)} part-time` : 'no part-time work'}</small></div>
            <div><span>Monthly {plan.monthlyGap >= 0 ? 'surplus' : 'gap'}</span><b className={plan.monthlyGap >= 0 ? 'positive' : 'negative'}>{fmt(Math.abs(plan.monthlyGap))}</b><small>income − cost</small></div>
          </div>
          <div className="bars">
            {plan.breakdown.map((b, i) => (
              <div className="bar-row" key={b.key}>
                <span>{LABELS[b.key]}</span>
                <div className="bar-track"><div style={{ width: `${(b.amount / maxCost) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                <b>{fmt(b.amount)}</b>
              </div>
            ))}
          </div>
          <div className="plan-total">
            <div><span>Total for {plan.months} months + one-off</span><b>{fmt(plan.totalNeeded)}</b></div>
            <div><span>Expected income over the period</span><b>{fmt(plan.totalIncome)}</b></div>
            <div><span>{plan.totalGap >= 0 ? 'Left over' : 'You need to save or find'}</span><b className={plan.totalGap >= 0 ? 'positive' : 'negative'}>{fmt(Math.abs(plan.totalGap))}</b></div>
          </div>
          <div className={`plan-status ${statusText.cls}`}><statusText.icon size={17} /> {statusText.text}</div>
          <div className="heading-actions plan-actions">
            <button className="secondary-btn" onClick={applyBudget}>Use as my monthly budget</button>
            <button className="primary-btn" onClick={() => app.askAgent(`I plan to study in ${plan.city} for ${plan.months} months. My monthly income is ${plan.monthlyIncome} EUR (family ${f.family}, scholarship ${f.scholarship}, part-time ${plan.partTimeIncome}) and one-off costs are ${plan.oneOffTotal} EUR. Estimate my budget and give me 3 concrete tips to close any gap.`)}><Bot size={15} /> Get agent advice</button>
          </div>
          <p className="disclaimer">City costs are rounded indicative estimates for a student in shared housing. Check local university housing offices for current prices.</p>
        </section>
      </div>
    </>
  );
}
