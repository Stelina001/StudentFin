// End-to-end API tests against a real server instance with a temporary database.
// The offline demo agent is used (no API key, no network), so results are deterministic.
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client, ask } from './helpers.js';

let srv, alice, bob;
const PW = 'correct-horse-42';

before(async () => {
  srv = await startServer();
  alice = client(srv.base);
  bob = client(srv.base);
});
after(async () => { await srv?.stop(); });

// ---------- accounts and sessions ----------
test('T-A01 health endpoint reports offline demo mode', async () => {
  const r = await client(srv.base).get('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.mode, 'demo');
});
test('T-A02 registration creates a session cookie that is HttpOnly and SameSite=Lax', async () => {
  const res = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-studentfin-client': '1' },
    body: JSON.stringify({ name: 'Cookie Check', email: 'cookie@test.dev', password: PW })
  });
  assert.equal(res.status, 201);
  const set = res.headers.get('set-cookie');
  assert.match(set, /sfin_session=/);
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=Lax/i);
});
test('T-A03 register two independent students', async () => {
  const a = await alice.post('/api/auth/register', { name: 'Alice', email: 'alice@test.dev', password: PW });
  const b = await bob.post('/api/auth/register', { name: 'Bob', email: 'bob@test.dev', password: PW });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.data.user.passwordHash, undefined, 'password hash must never be returned');
});
test('T-A04 weak passwords, invalid emails and duplicate accounts are rejected', async () => {
  const c = client(srv.base);
  assert.equal((await c.post('/api/auth/register', { name: 'X', email: 'x@test.dev', password: 'short' })).status, 400);
  assert.equal((await c.post('/api/auth/register', { name: 'Xy', email: 'not-an-email', password: PW })).status, 400);
  assert.equal((await c.post('/api/auth/register', { name: 'Alice 2', email: 'alice@test.dev', password: PW })).status, 409);
});
test('T-A05 wrong password gives a generic error; protected routes require a session', async () => {
  const c = client(srv.base);
  const r = await c.post('/api/auth/login', { email: 'alice@test.dev', password: 'wrong-password' });
  assert.equal(r.status, 401);
  assert.equal(r.data.error, 'Invalid email or password.');
  assert.equal((await c.get('/api/data')).status, 401);
});
test('T-A06 a forged session token is rejected', async () => {
  const r = await fetch(srv.base + '/api/data', { headers: { cookie: 'sfin_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged' } });
  assert.equal(r.status, 401);
});

// ---------- CSRF and headers ----------
test('T-A07 state-changing request without the client header is refused (CSRF)', async () => {
  const r = await alice.post('/api/transactions', { title: 'x', amount: 1, type: 'expense', category: 'Food', date: '2026-10-20' }, { csrf: false });
  assert.equal(r.status, 403);
});
test('T-A08 request from a foreign Origin is refused even with the header', async () => {
  const r = await alice.post('/api/transactions', { title: 'x', amount: 1, type: 'expense', category: 'Food', date: '2026-10-20' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});
test('T-A09 security headers are set on every response', async () => {
  const r = await alice.get('/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

// ---------- data validation and isolation ----------
test('T-A10 invalid transactions are rejected by server-side validation', async () => {
  const r = await alice.post('/api/transactions', { title: '', amount: -5, type: 'gift', category: 'Food', date: 'tomorrow' });
  assert.equal(r.status, 400);
});
test('T-A11 users cannot read or delete each other’s records', async () => {
  const created = await alice.post('/api/transactions', { title: 'Alice private', amount: 12, type: 'expense', category: 'Food', date: '2026-10-20' });
  assert.equal(created.status, 201);
  const bobData = await bob.get('/api/data');
  assert.ok(!bobData.data.transactions.some(t => t.title === 'Alice private'));
  assert.equal((await bob.del(`/api/transactions/${created.data.id}`)).status, 404);
  const aliceData = await alice.get('/api/data');
  assert.ok(aliceData.data.transactions.some(t => t.title === 'Alice private'));
});

// ---------- agent: propose → approve ----------
test('T-A12 agent proposes an expense; nothing changes until the student approves', async () => {
  const before = (await alice.get('/api/data')).data.transactions.length;
  const r = await ask(alice, 'I spent 12 eur on lunch');
  assert.equal(r.status, 200);
  assert.equal(r.data.actions.length, 1);
  assert.equal((await alice.get('/api/data')).data.transactions.length, before, 'no data change before approval');
  const d = await alice.post(`/api/proposals/${r.data.actions[0].id}/decision`, { decision: 'approved' });
  assert.equal(d.status, 200);
  const after = (await alice.get('/api/data')).data.transactions;
  assert.equal(after.length, before + 1);
  assert.equal(after.find(t => t.title === 'Lunch')?.source, 'agent');
});
test('T-A13 the same proposal cannot be approved twice (HTTP 409)', async () => {
  const r = await ask(alice, 'I spent 8 eur on coffee');
  const id = r.data.actions[0].id;
  assert.equal((await alice.post(`/api/proposals/${id}/decision`, { decision: 'approved' })).status, 200);
  assert.equal((await alice.post(`/api/proposals/${id}/decision`, { decision: 'approved' })).status, 409);
});
test('T-A14 one student cannot approve another student’s proposal', async () => {
  const r = await ask(alice, 'I spent 20 eur on books');
  const res = await bob.post(`/api/proposals/${r.data.actions[0].id}/decision`, { decision: 'approved' });
  assert.equal(res.status, 404);
  assert.equal(res.data.error, 'Proposal not found.');
});
test('T-A15 a request above the €300 limit is blocked before a proposal exists', async () => {
  const r = await ask(alice, 'I spent 900 eur on a laptop');
  assert.equal(r.data.actions.length, 0);
  assert.equal(r.data.trace[0].status, 'rejected_by_policy');
});
test('T-A16 policy is re-checked at approval time after the limit is lowered', async () => {
  const r = await ask(alice, 'I spent 150 eur on a jacket');
  assert.equal(r.data.actions.length, 1);
  await alice.put('/api/agent-settings', { enabled: true, maxActionAmount: 100 });
  const d = await alice.post(`/api/proposals/${r.data.actions[0].id}/decision`, { decision: 'approved' });
  assert.equal(d.status, 403);
  assert.equal(d.data.status, 'blocked');
  await alice.put('/api/agent-settings', { enabled: true, maxActionAmount: 300 });
});
test('T-A17 rejected proposals change nothing', async () => {
  const before = (await alice.get('/api/data')).data.user.budget.categoryLimits.Food;
  const r = await ask(alice, 'Set food budget to 150');
  assert.equal((await alice.post(`/api/proposals/${r.data.actions[0].id}/decision`, { decision: 'rejected' })).status, 200);
  assert.equal((await alice.get('/api/data')).data.user.budget.categoryLimits.Food, before);
});
test('T-A18 kill switch: paused agent answers but proposes nothing, and pending proposals expire', async () => {
  const pending = await ask(alice, 'I spent 5 eur on bus tickets');
  await alice.put('/api/agent-settings', { enabled: false, maxActionAmount: 300 });
  const r = await ask(alice, 'I spent 10 eur on lunch');
  assert.equal(r.data.mode, 'paused');
  assert.equal(r.data.actions.length, 0);
  const d = await alice.post(`/api/proposals/${pending.data.actions[0].id}/decision`, { decision: 'approved' });
  assert.equal(d.status, 409, 'proposal expired when the agent was paused');
  await alice.put('/api/agent-settings', { enabled: true, maxActionAmount: 300 });
});
test('T-A19 every tool call, proposal and decision is written to the audit log', async () => {
  const log = (await alice.get('/api/data')).data.activity;
  const kinds = new Set(log.map(l => l.kind));
  for (const k of ['tool', 'proposal', 'decision', 'manual', 'auth']) assert.ok(kinds.has(k), k);
  assert.ok(log.some(l => l.status === 'rejected_by_policy'));
});
test('T-A20 read-only tools: transfer comparison and scam check never create proposals', async () => {
  const t = await ask(alice, 'My parents send me 60000 lek every month. What is the cheapest way?');
  assert.equal(t.data.actions.length, 0);
  assert.equal(t.data.trace[0].tool, 'compare_transfer_options');
  const s = await ask(alice, 'Is this a scam: pay the deposit by Western Union today, I am abroad and keys will be sent');
  assert.equal(s.data.actions.length, 0);
  assert.match(s.data.answer, /HIGH/);
});
