// Lightweight security middleware (no external dependencies).

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// Sliding-window rate limiter per client IP.
export function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear(); // memory guard
    next();
  };
}

// CSRF protection for cookie-based sessions: every state-changing request must carry the custom
// header X-StudentFin-Client. Browsers do not let other websites add custom headers to cross-site
// requests without a CORS preflight, which our CORS policy rejects. The Origin header is checked too.
const ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-studentfin-client') !== '1') return res.status(403).json({ error: 'Missing client header (CSRF protection).' });
  const origin = req.headers.origin;
  if (origin) {
    const self = `${req.protocol}://${req.headers.host}`;
    if (origin !== self && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'Cross-site request blocked.' });
  }
  next();
}

// --- input sanitising helpers ---
export const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
export const num = (v, { min = -1e9, max = 1e9 } = {}) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};
export const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(v));

// Reduce the client-provided context to a bounded, typed summary before it reaches the model.
export function sanitizeContext(c = {}) {
  const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  return {
    today: isDate(c.today) ? c.today : new Date().toISOString().slice(0, 10),
    displayCurrency: str(c.displayCurrency, 3) || 'EUR',
    monthlyIncomePlan: num(c.monthlyIncomePlan, { min: 0 }),
    savingsGoal: num(c.savingsGoal, { min: 0 }),
    income: num(c.income), expenses: num(c.expenses), balance: num(c.balance),
    categorySpending: arr(c.categorySpending, 20).map(x => ({ name: str(x?.name, 40), value: num(x?.value) })),
    categoryLimits: Object.fromEntries(Object.entries(c.categoryLimits || {}).slice(0, 20).map(([k, v]) => [str(k, 40), num(v, { min: 0 })])),
    recentTransactions: arr(c.recentTransactions, 30).map(t => ({
      title: str(t?.title, 80), category: str(t?.category, 40), date: str(t?.date, 10), amountEur: num(t?.amount), type: t?.type === 'income' ? 'income' : 'expense',
      originalAmount: t?.originalAmount != null ? num(t.originalAmount) : undefined, originalCurrency: t?.originalCurrency ? str(t.originalCurrency, 3) : undefined
    })),
    payments: arr(c.payments, 30).map(p => ({ title: str(p?.title, 80), amountEur: num(p?.amount), due: str(p?.due, 10), paid: Boolean(p?.paid) })),
    agent: {
      enabled: c.agent?.enabled !== false,
      maxActionAmount: num(c.agent?.maxActionAmount ?? 300, { min: 1, max: 5000 })
    }
  };
}
