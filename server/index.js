import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { securityHeaders, rateLimit, csrfGuard, str } from './security.js';
import { getEurRates } from './rates.js';
import { scamCheck } from '../shared/scam.js';
import { initDb } from './db.js';
import { ensureDemoUser, DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';
import { register, login, logout, demoLogin, requireAuth, publicUser } from './auth.js';
import { api } from './api.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(securityHeaders);
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', csrfGuard);

// ---- public endpoints ----
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: hasKey(), mode: hasKey() ? 'claude' : 'demo', model: hasKey() ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5') : null, demoAccount: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
});
app.get('/api/rates', async (_req, res) => res.json(await getEurRates()));
app.post('/api/scam-check', rateLimit({ max: 30 }), (req, res) => {
  const r = scamCheck(str(req.body?.text, 5000));
  res.status(r.error ? 400 : 200).json(r);
});

// ---- authentication ----
const authLimit = rateLimit({ windowMs: 15 * 60_000, max: 20 }); // brute-force protection
app.post('/api/auth/register', authLimit, register);
app.post('/api/auth/login', authLimit, login);
app.post('/api/auth/demo', authLimit, demoLogin);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---- everything else requires a logged-in user ----
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, _req, res, _next) => {
  console.error('Server error:', err?.message || err);
  res.status(err?.status === 400 ? 400 : 500).json({ error: err?.status === 400 ? 'Invalid request.' : 'Something went wrong on the server.' });
});

// Production: serve the built frontend (npm run build && npm start)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const dbFile = await initDb();
await ensureDemoUser();
app.listen(port, () => {
  console.log(`StudentFin AI API running at http://localhost:${port} (${hasKey() ? 'Claude' : 'demo'} mode)`);
  console.log(`Database: ${dbFile}`);
  console.log(`Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});
