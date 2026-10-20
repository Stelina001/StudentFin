# StudentFin AI

**An AI finance agent for students who study or receive money across borders.**
Entry for the 2026 Shenzhen International FinTech Competition (FinTechathon), International Track — **Topic C: Cross-border & Student Finance Assistant**. Theme: *AI as a Financial Participant*.

The agent reads the student's finances, compares cross-border transfer options, plans study-abroad budgets, spots scams and **prepares** changes to the budget. Every change must be approved by the student, and the agent can never move money.

---

## Features

| Area | What it does |
| --- | --- |
| **Accounts** | Register, log in and log out; every user has a private workspace stored in the database. A shared **demo account** (`demo@studentfin.app` / `demo1234`, or the *Explore the demo account* button) always opens with the sample workspace |
| **Overview** | Balance, income, expenses, savings target, proactive alerts, monthly spending chart, category breakdown |
| **Budget** | Monthly income plan, savings goal, per-category limits with progress for the current month |
| **Transactions** | Income and expenses in 16 currencies, stored in EUR with the original amount kept; search, filter, CSV export |
| **Payments** | Bills and tuition reminders with due-soon / overdue badges |
| **Money across borders** | Compares 6 provider types (bank wire, remittance agent, online transfer app, fintech app, wallet, postal order): amount received, fees, FX margin, speed; corridor presets (Albania → Italy, Germany → Albania, UK → Albania, Switzerland → Kosovo); record transfer cost as an expense |
| **Study abroad planner** | Indicative monthly student costs for 15 cities, income from family / scholarship / part-time work, one-off costs, monthly and total gap; "use as my budget" |
| **Scam check** | Explainable rule-based detector for rental, job, scholarship and bank-message scams (10 signal types, risk score 0–10) |
| **AI agent** | Claude with tool use: 6 read-only tools and 4 *proposal* tools. Proposals appear as cards with **Approve / Reject** |
| **Agent activity log** | Audit trail of every tool call, proposal and decision; JSON export |
| **Settings** | Profile, display currency (live conversion), **agent kill switch**, **per-action amount limit**, backup export/import, reset to sample data |
| **Alerts** | Overdue / due-soon payments, categories at 80 % or over limit, spending above plan, savings goal progress |

The app also works **without an API key**: a rule-based demo planner uses the same tools and policy checks, so every feature can be tested offline.

---

## Run locally

Requirements: Node.js 18+ and (optionally) an Anthropic API key from https://console.anthropic.com.

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
# optional: put your key in .env → ANTHROPIC_API_KEY=...
npm run dev
```

Open **http://localhost:5173** and click **Explore the demo account**, or create your own account. The API runs on port 3001 and Vite proxies `/api` to it.

The database file `data/studentfin.db` is created automatically on first start (no database server to install). `npm run db:reset` deletes it to start fresh.

Production (one server, one port): `npm run prod`, then open http://localhost:3001.

### Demo prompts (work in demo mode too)

- `My parents send me 60000 lek every month. What is the cheapest way?`
- `I spent 5000 lek on books` → proposal card → Approve
- `I spent 900 eur on a laptop` → blocked by the €300 per-action limit
- `Cost of living to study in Milan with 700 eur a month`
- `Remind me to pay internet 15 on 2026-11-02`
- `Set food budget to 150` / `Review my budget and suggest new limits`
- `Is this a scam: pay the deposit by Western Union today, I am abroad and keys will be sent`

---

## Deployment

**1. Requirements.** Node.js 18+ (tested on 22) on any Linux, macOS or Windows host. No database server is needed: SQLite is created automatically in `data/`.

**2. Configure** `.env` (copy from `.env.example`):

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Optional. Enables the Claude agent; without it the offline demo planner is used |
| `ANTHROPIC_MODEL` | Optional, default `claude-sonnet-5-5` |
| `PORT` | HTTP port, default `3001` |
| `JWT_SECRET` | Session signing secret, at least 32 random characters (recommended in production) |
| `DB_PATH` / `DATABASE_URL` | SQLite file path, or a PostgreSQL URL (`postgres://user:pass@host:5432/db`, then `npm install pg pg-hstore`) |
| `NODE_ENV` | Set to `production` so the session cookie is sent over HTTPS only |

**3. Build and start** (frontend and API served together on one port):

```bash
npm ci            # or npm install
npm run build
NODE_ENV=production npm start      # Windows PowerShell: $env:NODE_ENV="production"; npm start
```

**4. Put it behind HTTPS.** Run it behind a reverse proxy (nginx, Caddy) or a platform that terminates TLS (Render, Railway, Fly.io, a VM). The server trusts `X-Forwarded-*` headers from the local proxy only. Keep it running with a process manager such as `pm2 start server/index.js --name studentfin`.

**5. Keep secrets out of git.** `.env` and `data/` are listed in `.gitignore`; never commit the API key or the database.

---

## Tests

```bash
npm test
```

36 automated test cases, built on Node's built-in test runner (no extra dependencies):

- `tests/unit.test.js` — 16 unit tests for the transfer cost model, scam detector, study planner, currency conversion and the agent's permission tiers (propose-only write tools, per-action limit, kill switch, 3-proposal cap, unknown tools).
- `tests/api.test.js` — 20 end-to-end tests that start a real server with a **temporary database** and the deterministic offline agent: registration and login, cookie flags, forged tokens, CSRF and foreign-origin requests, security headers, input validation, cross-user isolation, propose → approve, double approval (409), approving another user's proposal (404), the €300 limit, policy re-check at approval, rejection, kill switch and audit logging.

The tests never touch your own `data/studentfin.db` and never call the Anthropic API. The full list with expected results is in [`TEST_CASES.md`](TEST_CASES.md).

## Sandbox operation logs

```bash
npm run sandbox
```

Runs 14 realistic scenarios on a **simulated student account** in an isolated sandbox server and writes the results to [`sandbox-logs/`](sandbox-logs):

- `operation-log.md` — readable log: each request, the tools the agent called, its answer, the proposals, the student's decision and whether data changed
- `operation-log.json` — the same in machine-readable form
- `activity-log.json` — the raw per-user audit trail from the database

No real money, bank or payment system is involved: the agent can only read data and propose records that the student approves or rejects.

---

## Data model (code-first)

The schema is defined in code in `server/db.js` (Sequelize ORM) and the tables are generated from it on start-up with `sequelize.sync()`. SQLite is used by default; set `DATABASE_URL` to use PostgreSQL instead.

| Model | Key fields | Notes |
| --- | --- | --- |
| `User` | name, email (unique), passwordHash, country, studyCity, currency, monthlyIncome, savingsGoal, categoryLimits (JSON), agentEnabled, maxActionAmount, isDemo | Budget and agent policy live on the user |
| `Transaction` | userId, title, amount (EUR), type, category, date, originalAmount, originalCurrency, source (`manual` / `agent` / `seed` / `import`) | Original currency is kept for cross-border records |
| `Payment` | userId, title, amount, due, category, paid, source | Bills and reminders |
| `Proposal` | id, userId, type, params (JSON), reason, status (`pending` / `approved` / `rejected` / `expired` / `blocked`) | A change the AI agent wants to make; applied only on approval |
| `ActivityLog` | userId, kind (`tool` / `proposal` / `decision` / `manual` / `auth`), tool, actionType, input, params, status, reason | Append-only audit trail |

Every record belongs to one `User` (`userId` foreign key, cascade delete) and every query is filtered by the logged-in user's id.

## Architecture

```
Browser (React + Vite)                         Server (Node + Express)
┌──────────────────────────────┐   /api/agent   ┌────────────────────────────────────┐
│ Login / register screen      │  JSON + cookie │ auth: bcrypt hashes, JWT in        │
│ Pages · alerts · charts      │ ─────────────▶ │ http-only cookie, CSRF header,     │
│ Approve / Reject cards       │                │ rate limits, input validation      │
│ (send decision only)         │ ◀───────────── │ api.js: per-user CRUD (userId)     │
│                              │  data, answer, │ agent: context built from the DB,  │
│                              │  proposals,    │ Claude tool use or demo planner    │
│                              │  tool trace    │ proposals stored → applied on      │
└──────────────────────────────┘                │ approval in a DB transaction       │
           │  shared/ (same code both sides)    │ SQLite via Sequelize (code-first)  │
           └─ transfers · cities · scam · rates └────────────────────────────────────┘
```

| Path | Purpose |
| --- | --- |
| `shared/transfers.js` | Transfer cost model: fee = fixed + % ; received = (amount − fee) × mid-rate × (1 − FX margin) |
| `shared/cities.js` | City cost data and `studyPlan()` |
| `shared/scam.js` | Scam signal rules and scoring |
| `shared/rates.js` | Currency list, fallback rates, conversion |
| `server/db.js` | Code-first models and relationships |
| `server/seed.js` | Sample workspace and demo account |
| `server/auth.js` | Register, login, logout, demo login, session middleware |
| `server/api.js` | Per-user REST API, agent endpoint, proposal decisions |
| `server/agent.js` | Claude tool-use loop + offline demo planner |
| `server/tools.js` | Tool definitions, execution, proposal validation and policy |
| `server/security.js` | Security headers, rate limiter, context sanitising |
| `server/rates.js` | Live rates from open.er-api.com with cache and fallback |
| `src/App.jsx` | Session handling, workspace state, API calls |
| `src/pages/AuthScreen.jsx` | Log in / create account / demo |
| `src/pages/*` | One file per page |

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Server status, AI mode, demo credentials |
| `GET /api/rates` | EUR-based reference rates, source `live` or `fallback` |
| `POST /api/scam-check` | `{ text }` → `{ level, score, signals[], advice }` |
| `POST /api/auth/register` · `login` · `demo` · `logout`, `GET /api/auth/me` | Accounts and sessions |
| `GET /api/data` | Everything for the logged-in user |
| `POST/DELETE /api/transactions`, `POST/PATCH/DELETE /api/payments` | Records |
| `PUT /api/budget` · `/api/profile` · `/api/agent-settings` | Settings |
| `POST /api/agent` | `{ messages }` → `{ answer, actions[], trace[], mode }` (context is read from the database) |
| `POST /api/proposals/:id/decision` | `{ decision: approved \| rejected }` → applies the stored proposal |
| `GET/POST/DELETE /api/activity`, `POST /api/reset`, `POST /api/import` | Audit log and data management |

All endpoints except health, rates, scam-check and auth require a valid session.

---

## Security design

1. **Accounts.** Passwords are hashed with bcrypt (cost 12) and never stored or logged in plain text. Login errors do not reveal whether an email exists. Login and registration are rate-limited (20 attempts per 15 minutes per IP).
2. **Sessions.** A signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) that JavaScript cannot read. It expires after 7 days. The signing secret comes from `.env` or is generated once in `data/.jwt-secret`.
3. **CSRF.** Every state-changing request must carry the `X-StudentFin-Client` header and a same-site `Origin`. Browsers cannot add that header to cross-site requests without a CORS preflight, which the server rejects.
4. **Data isolation.** Every query is scoped by `userId`. A user cannot read, change or approve another user's records or proposals (tested).
5. **Propose, never execute.** The agent's write tools only create proposals, which are stored in the database. The browser sends only *approve* or *reject*, so it cannot change a proposal's content. The server applies it inside a database transaction.
6. **Server-side policy.** Proposals are validated (amount, date, category) and checked against the user's per-action limit (default €300, max €5,000) when created **and again when approved**. The agent is limited to 3 proposals per message and 6 steps. Pending proposals expire on the next request or when the agent is paused.
7. **Trusted context.** The agent's view of balances, limits and payments is built from the database on the server, not sent by the browser.
8. **Kill switch.** Pausing the agent blocks it on the server and expires any pending proposals.
9. **No money movement.** No bank connection and no payment API.
10. **Secrets.** The Anthropic API key exists only in the server's `.env`.
11. **Prompt-injection resistance.** Pasted text and tool results are treated as data. Even a manipulated model can only create proposals that the user must approve.
12. **Abuse protection.** Agent rate limit (20 per minute), 1 MB body limit, string length caps, security headers (`nosniff`, `DENY` framing, no referrer).
13. **Transparency.** Every tool call, proposal, decision and login is written to the per-user activity log.

## Data and limitations

- Provider fees are **illustrative types** with typical published ranges, not live quotes from real companies.
- City costs are rounded indicative estimates for students in shared housing.
- Exchange rates come from open.er-api.com when reachable, otherwise from bundled estimates (shown as "Offline rate estimates").
- The demo account is shared and resets to the sample workspace at the start of each month (or via Settings → Reset).
- Educational guidance only, not regulated financial advice.
