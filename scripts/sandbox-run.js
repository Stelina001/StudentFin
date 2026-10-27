
// Run: npm run sandbox
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, client, ask } from '../tests/helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'sandbox-logs');
fs.mkdirSync(outDir, { recursive: true });

const ACCOUNT = { name: 'Sandbox Student', email: 'sandbox.student@studentfin.test', password: 'sandbox-pass-2026' };


const SCENARIOS = [
  { id: 'S01', title: 'Financial summary (read-only)', say: 'Give me a summary', decide: null },
  { id: 'S02', title: 'Cheapest way to receive the family allowance', say: 'My parents send me 60000 lek every month. What is the cheapest way?', decide: null },
  { id: 'S03', title: 'Record an expense — approved', say: 'I spent 12 eur on lunch', decide: 'approved' },
  { id: 'S04', title: 'Record an expense in lek — approved (converted to EUR)', say: 'I spent 5000 lek on books', decide: 'approved' },
  { id: 'S05', title: 'Record income — approved', say: 'I received 300 eur scholarship', decide: 'approved' },
  { id: 'S06', title: 'Payment reminder — approved', say: 'Remind me to pay internet 15 on 2026-11-02', decide: 'approved' },
  { id: 'S07', title: 'Budget limit change — rejected by the student', say: 'Set food budget to 150', decide: 'rejected' },
  { id: 'S08', title: 'Budget review — agent proposes several limits', say: 'Review my budget limits and suggest improvements', decide: 'approve-first' },
  { id: 'S09', title: 'Amount above the €300 per-action limit — blocked by policy', say: 'I spent 900 eur on a laptop', decide: null },
  { id: 'S10', title: 'Scam check on a rental message (read-only)', say: 'Is this a scam: pay the deposit by Western Union today, I am abroad and keys will be sent', decide: null },
  { id: 'S11', title: 'Study-abroad budget (read-only)', say: 'Cost of living to study in Milan with 700 eur a month', decide: null },
  { id: 'S12', title: 'Limit lowered after proposal — blocked at approval', say: 'I spent 150 eur on a jacket', lowerLimitTo: 100, decide: 'approved' },
  { id: 'S13', title: 'Kill switch on — agent paused, no proposals', pauseFirst: true, say: 'I spent 10 eur on lunch', decide: null },
  { id: 'S14', title: 'Replay attempt — approving an already-approved proposal', replay: true }
];

const srv = await startServer();
const c = client(srv.base);
const steps = [];
const now = () => new Date().toISOString();
let lastApprovedId = null;

try {
  const reg = await c.post('/api/auth/register', ACCOUNT);
  if (reg.status !== 201) throw new Error('Could not create the sandbox account: ' + JSON.stringify(reg.data));
  const snapshot = async () => {
    const d = (await c.get('/api/data')).data;
    return { transactions: d.transactions.length, payments: d.payments.length, savingsGoal: d.user.budget.savingsGoal, limits: d.user.budget.categoryLimits, agent: d.user.agent };
  };
  const start = await snapshot();

  for (const s of SCENARIOS) {
    const step = { id: s.id, title: s.title, time: now() };
    if (s.replay) {
      const r = await c.post(`/api/proposals/${lastApprovedId}/decision`, { decision: 'approved' });
      Object.assign(step, { request: `POST /api/proposals/${lastApprovedId}/decision (second time)`, httpStatus: r.status, result: r.data });
      steps.push(step);
      continue;
    }
    if (s.pauseFirst) {
      await c.put('/api/agent-settings', { enabled: false, maxActionAmount: 300 });
      step.setup = 'Student turned the agent OFF in Settings (kill switch).';
    }
    const before = await snapshot();
    const r = await ask(c, s.say);
    Object.assign(step, { studentSays: s.say, mode: r.data.mode, toolCalls: r.data.trace, agentAnswer: r.data.answer, proposals: r.data.actions.map(a => ({ id: a.id, type: a.type, params: a.params, reason: a.reason })) });
    if (s.lowerLimitTo) {
      await c.put('/api/agent-settings', { enabled: true, maxActionAmount: s.lowerLimitTo });
      step.setup = `After the proposal, the student lowered the per-action limit to €${s.lowerLimitTo}.`;
    }
    const decisions = [];
    const targets = s.decide === 'approve-first' ? r.data.actions.map((a, i) => [a, i === 0 ? 'approved' : 'rejected'])
      : s.decide ? r.data.actions.map(a => [a, s.decide]) : [];
    for (const [a, d] of targets) {
      const res = await c.post(`/api/proposals/${a.id}/decision`, { decision: d });
      decisions.push({ proposalId: a.id, decision: d, httpStatus: res.status, result: res.data });
      if (res.status === 200 && d === 'approved') lastApprovedId = a.id;
    }
    step.decisions = decisions;
    const after = await snapshot();
    const data = x => JSON.stringify({ ...x, agent: undefined }); 
    step.dataChanged = data(before) !== data(after);
    step.delta = { transactions: after.transactions - before.transactions, payments: after.payments - before.payments };
    if (s.lowerLimitTo) await c.put('/api/agent-settings', { enabled: true, maxActionAmount: 300 });
    if (s.pauseFirst) await c.put('/api/agent-settings', { enabled: true, maxActionAmount: 300 });
    steps.push(step);
  }

  const end = await snapshot();
  const activity = (await c.get('/api/data')).data.activity.slice().reverse();
  const meta = {
    product: 'StudentFin AI', team: 'Neura', competition: 'FinTechathon 2026 · International Track · Topic C',
    generatedAt: now(), environment: 'Isolated sandbox server, temporary SQLite database, simulated student account',
    agentMode: steps[0]?.mode, account: ACCOUNT.email,
    note: 'Simulated account only. StudentFin AI cannot move real money: the agent can only read data and propose budget records, which the student approves or rejects.'
  };
  const counts = {
    scenarios: steps.length,
    toolCalls: activity.filter(l => l.kind === 'tool').length,
    proposals: activity.filter(l => l.kind === 'proposal').length,
    approved: activity.filter(l => l.kind === 'decision' && l.status === 'approved').length,
    rejectedByStudent: activity.filter(l => l.kind === 'decision' && l.status === 'rejected').length,
    blockedByPolicy: activity.filter(l => l.status === 'rejected_by_policy').length
  };
  fs.writeFileSync(path.join(outDir, 'operation-log.json'), JSON.stringify({ meta, counts, start, end, steps }, null, 2));
  fs.writeFileSync(path.join(outDir, 'activity-log.json'), JSON.stringify(activity, null, 2));

  // Human-readable version
  const md = [`# StudentFin AI — Sandbox Operation Log`, '', `Generated ${meta.generatedAt} · agent mode: **${meta.agentMode}** · account: \`${meta.account}\``, '', `> ${meta.note}`, '',
    `| Scenarios | Tool calls | Proposals | Approved | Rejected by student | Blocked by policy |`, `|---|---|---|---|---|---|`,
    `| ${counts.scenarios} | ${counts.toolCalls} | ${counts.proposals} | ${counts.approved} | ${counts.rejectedByStudent} | ${counts.blockedByPolicy} |`, ''];
  for (const s of steps) {
    md.push(`## ${s.id} — ${s.title}`, '', `*${s.time}*`, '');
    if (s.setup) md.push(`Setup: ${s.setup}`, '');
    if (s.studentSays) {
      md.push(`**Student:** ${s.studentSays}`, '');
      md.push(`**Tool calls:** ${s.toolCalls.length ? s.toolCalls.map(t => `\`${t.tool}\` → ${t.status}`).join(', ') : 'none'}`, '');
      md.push('**Agent:**', '```', s.agentAnswer, '```');
      if (s.proposals.length) md.push(`**Proposals:** ${s.proposals.map(p => `\`${p.type}\` ${JSON.stringify(p.params)}`).join('; ')}`, '');
      if (s.decisions.length) md.push(`**Decisions:** ${s.decisions.map(d => `${d.decision} → HTTP ${d.httpStatus}${d.result?.error ? ` (${d.result.error})` : ''}`).join('; ')}`, '');
      md.push(`**Data changed:** ${s.dataChanged ? 'yes' : 'no'} (transactions ${s.delta.transactions >= 0 ? '+' : ''}${s.delta.transactions}, payments ${s.delta.payments >= 0 ? '+' : ''}${s.delta.payments})`, '');
    } else {
      md.push(`**Request:** ${s.request}`, '', `**Result:** HTTP ${s.httpStatus} — ${s.result?.error || JSON.stringify(s.result)}`, '');
    }
  }
  md.push('## Audit trail', '', '| # | Time (UTC) | Kind | Tool / action | Status |', '|---|---|---|---|---|');
  activity.forEach((l, i) => md.push(`| ${i + 1} | ${String(l.time).replace('T', ' ').slice(0, 19)} | ${l.kind} | ${l.tool || l.actionType || ''} | ${l.status || ''} |`));
  fs.writeFileSync(path.join(outDir, 'operation-log.md'), md.join('\n') + '\n');

  console.log(`Sandbox run complete: ${counts.scenarios} scenarios, ${counts.toolCalls} tool calls, ${counts.proposals} proposals, ${counts.approved} approved, ${counts.rejectedByStudent} rejected, ${counts.blockedByPolicy} blocked by policy.`);
  console.log(`Logs written to ${outDir}`);
} finally {
  await srv.stop();
}
