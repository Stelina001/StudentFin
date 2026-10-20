import React, { useState } from 'react';
import { Download, Trash2, History, Check, X, Wrench } from 'lucide-react';
import { PageHeading, StatCard } from '../components/ui.jsx';
import { downloadFile } from '../lib/util.js';

const KIND = { tool: 'Tool call', proposal: 'Proposal', decision: 'Decision', manual: 'User action', auth: 'Account' };

function summary(e) {
  if (e.kind === 'tool') {
    const inp = e.input && Object.keys(e.input).length ? JSON.stringify(e.input) : '';
    return `${e.tool}${inp ? ` ${inp.length > 90 ? inp.slice(0, 90) + '…' : inp}` : ''}`;
  }
  const p = e.params && Object.keys(e.params).length ? JSON.stringify(e.params) : '';
  return `${e.actionType}${p ? ` ${p.length > 90 ? p.slice(0, 90) + '…' : p}` : ''}`;
}

export default function Activity({ app }) {
  const { activity } = app;
  const [filter, setFilter] = useState('all');
  const list = activity.filter(e => filter === 'all' || e.kind === filter);
  const approved = activity.filter(e => e.kind === 'decision' && e.status === 'approved').length;
  const rejected = activity.filter(e => e.kind === 'decision' && e.status === 'rejected').length;
  const blocked = activity.filter(e => e.kind === 'tool' && e.status === 'rejected_by_policy').length;

  return (
    <>
      <PageHeading eyebrow="TRANSPARENCY" title="Agent activity log" text="An audit trail of every tool the agent used, every change it proposed and every decision you made.">
        <button className="secondary-btn" onClick={() => downloadFile('studentfin-activity-log.json', JSON.stringify(activity, null, 2), 'application/json')} disabled={!activity.length}><Download size={15} /> Export JSON</button>
        <button className="secondary-btn" onClick={() => app.clearActivity().then(() => app.setToast('Activity log cleared.')).catch(app.fail)} disabled={!activity.length}><Trash2 size={15} /> Clear</button>
      </PageHeading>
      <div className="stat-grid">
        <StatCard label="Tool calls" value={String(activity.filter(e => e.kind === 'tool').length)} icon={Wrench} tone="violet" sub="read-only and proposals" />
        <StatCard label="Approved" value={String(approved)} icon={Check} tone="mint" sub="changes you accepted" />
        <StatCard label="Rejected" value={String(rejected)} icon={X} tone="rose" sub="changes you declined" />
        <StatCard label="Blocked by policy" value={String(blocked)} icon={History} tone="amber" sub="over limit or invalid" />
      </div>
      <section className="panel transactions-panel">
        <div className="filter-bar">
          <div className="filter-tabs">{[['all', 'All'], ['tool', 'Tool calls'], ['proposal', 'Proposals'], ['decision', 'Decisions'], ['manual', 'User actions'], ['auth', 'Account']].map(([id, l]) => <button key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{l}</button>)}</div>
          <span className="muted small-text">{list.length} entries</span>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table className="data-table activity-table">
              <thead><tr><th>Time</th><th>Type</th><th>Details</th><th>Status</th></tr></thead>
              <tbody>
                {list.map(e => (
                  <tr key={e.id}>
                    <td className="date-cell">{new Date(e.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td><span className="category-pill">{KIND[e.kind] || e.kind}</span></td>
                    <td><code className="log-code">{summary(e)}</code>{e.reason && <small className="log-reason">{e.reason}</small>}</td>
                    <td><span className={`log-status s-${e.status}`}>{String(e.status).replaceAll('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state">No activity yet. Ask the AI agent something to see its tool calls here.</div>}
      </section>
    </>
  );
}
