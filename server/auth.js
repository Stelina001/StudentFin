import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User, ActivityLog } from './db.js';
import { seedUser, ensureDemoUser, DEMO_EMAIL } from './seed.js';
import { str } from './security.js';

const COOKIE = 'sfin_session';
const SESSION_DAYS = 7;

// JWT signing secret: from .env, or generated once and kept in data/.jwt-secret (never sent to the browser).
function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', '.jwt-secret');
  try { const s = fs.readFileSync(file, 'utf8').trim(); if (s.length >= 32) return s; } catch { /* create below */ }
  const s = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

const cookieOptions = () => ({
  httpOnly: true,                                   // not readable from JavaScript (XSS cannot steal it)
  sameSite: 'lax',                                  // not sent on cross-site POSTs (CSRF)
  secure: process.env.NODE_ENV === 'production',    // HTTPS only in production
  maxAge: SESSION_DAYS * 86_400_000,
  path: '/'
});

function startSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, cookieOptions());
}

export function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, country: u.country, studyCity: u.studyCity, currency: u.currency,
    isDemo: u.isDemo,
    budget: { income: u.monthlyIncome, savingsGoal: u.savingsGoal, categoryLimits: u.categoryLimits },
    agent: { enabled: u.agentEnabled, maxActionAmount: u.maxActionAmount }
  };
}

// Middleware: resolve the logged-in user or reject with 401.
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please log in.' });
    const { sub } = jwt.verify(token, SECRET);
    const user = await User.findByPk(Number(sub));
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    req.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE, { path: '/' });
    res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,20}$/;

export async function register(req, res) {
  const name = str(req.body?.name, 80);
  const email = str(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters.' });
  if (await User.findOne({ where: { email } })) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  await seedUser(user); // new accounts start with the sample workspace
  await ActivityLog.create({ userId: user.id, kind: 'auth', actionType: 'register', status: 'ok' });
  startSession(res, user);
  res.status(201).json({ user: publicUser(await user.reload()) });
}

export async function login(req, res) {
  const email = str(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  const user = email ? await User.findOne({ where: { email } }) : null;
  // Compare even when the user is missing so response time does not reveal which emails exist.
  const ok = await bcrypt.compare(password, user?.passwordHash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.isDemo) await ensureDemoUser();
  await ActivityLog.create({ userId: user.id, kind: 'auth', actionType: 'login', status: 'ok' });
  startSession(res, user);
  res.json({ user: publicUser(await user.reload()) });
}

export async function demoLogin(_req, res) {
  const demo = await ensureDemoUser();
  startSession(res, demo);
  res.json({ user: publicUser(demo) });
}

export function logout(_req, res) {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

export { DEMO_EMAIL };
