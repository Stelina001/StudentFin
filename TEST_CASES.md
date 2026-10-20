# StudentFin AI — Test Cases

Run all of them with `npm test` (Node.js built-in test runner, no extra dependencies).
Last run: **36 / 36 passed** (Node.js 22, offline demo agent, temporary database).

## Unit tests — `tests/unit.test.js`

| ID | Area | What is tested | Expected result |
|---|---|---|---|
| T-U01 | Transfer model | Fee and amount received for €500 → ALL by bank wire | `fee = F·r + p·A`, `received = (A − fee)·m·(1 − μ)` within €0.01 |
| T-U02 | Transfer model | Ranking of the 6 provider types for 60 000 ALL → EUR | Sorted by amount received, best first; savings vs. worst > 0 |
| T-U03 | Transfer model | Same-currency transfer | No FX margin applied |
| T-U04 | Transfer model | Zero amount, unknown currency | Error returned |
| T-U05 | Scam check | Rental message with deposit, Western Union, “I am abroad” | Level **high**; signals upfront, untraceable, abroad, each with explanation |
| T-U06 | Scam check | Normal university message | Level **low**, score 0 |
| T-U07 | Scam check | Message with every signal; empty input | Score capped at 10; empty input rejected |
| T-U08 | Study planner | Milan, 10 months, €700/month | Monthly cost = costs + 10 % buffer; gap = income − cost; 15 cities available |
| T-U09 | Study planner | Unknown city | Error returned |
| T-U10 | Currency | EUR ↔ ALL conversion, unknown currency | 100 EUR = 9 750 ALL (fallback rate); unknown → `null` |
| T-U11 | Permission tiers | Tool catalogue | 10 tools; exactly 4 write tools, all named `propose_*` |
| T-U12 | Permission tiers | Write tool call | Returns a proposal only (`status: proposed`); nothing applied |
| T-U13 | Permission tiers | Expense of €900 with €300 limit | `rejected_by_policy`, no proposal created |
| T-U14 | Permission tiers | 60 000 ALL (≈ €615) with €300 limit | Limit applied after conversion → `rejected_by_policy` |
| T-U15 | Kill switch | Write tool while agent is paused | Error, no proposal |
| T-U16 | Permission tiers | 4th proposal in one message; unknown tool `transfer_money` | “at most 3 proposals” error; unknown tool refused |

## End-to-end API tests — `tests/api.test.js`

Each run starts a real server on a free port with a **temporary SQLite database** and the deterministic offline agent.

| ID | Area | What is tested | Expected result |
|---|---|---|---|
| T-A01 | Health | `GET /api/health` without API key | 200, mode `demo` |
| T-A02 | Sessions | Registration response cookie | `sfin_session` cookie is `HttpOnly` and `SameSite=Lax` |
| T-A03 | Accounts | Register two students | 201; password hash never returned |
| T-A04 | Accounts | Short password, invalid email, duplicate email | 400, 400, 409 |
| T-A05 | Accounts | Wrong password; protected route without session | 401 with generic “Invalid email or password.”; 401 |
| T-A06 | Sessions | Forged JWT cookie | 401 |
| T-A07 | CSRF | State-changing request without `X-StudentFin-Client` | 403 |
| T-A08 | CSRF | Request from `Origin: https://evil.example` | 403 |
| T-A09 | Headers | Security headers | `nosniff`, `X-Frame-Options: DENY`, no `X-Powered-By` |
| T-A10 | Validation | Empty title, negative amount, bad type and date | 400 |
| T-A11 | Isolation | Bob reads / deletes Alice's transaction | Not visible; delete → 404; Alice's record intact |
| T-A12 | Agent | “I spent 12 eur on lunch” → approve | No change before approval; +1 transaction with `source: agent` after |
| T-A13 | Agent | Approve the same proposal twice | 200, then **409** |
| T-A14 | Isolation | Bob approves Alice's proposal | **404** “Proposal not found.” |
| T-A15 | Policy | “I spent 900 eur on a laptop” | No proposal; tool status `rejected_by_policy` |
| T-A16 | Policy | Limit lowered to €100 after a €150 proposal, then approve | **403**, proposal `blocked` |
| T-A17 | Agent | Reject a budget-limit proposal | Limit unchanged |
| T-A18 | Kill switch | Pause the agent, then ask and approve an older proposal | Mode `paused`, no proposals; older proposal expired → 409 |
| T-A19 | Audit | Activity log after the run | Contains tool, proposal, decision, manual and auth entries, including a policy block |
| T-A20 | Read-only tools | Transfer comparison and scam check | No proposals; scam answer shows **HIGH** |

## Manual checks (browser)

| ID | Steps | Expected result |
|---|---|---|
| M-01 | Open http://localhost:5173 → *Explore the demo account* | Overview with balance, chart, alerts |
| M-02 | Assistant → “I spent 5000 lek on books” → **Approve** | Card turns approved; transaction appears in Transactions in EUR with original ALL amount |
| M-03 | Settings → turn the agent off → ask anything | “The assistant is paused”; no proposal cards |
| M-04 | Agent activity log → Export JSON | File contains every tool call and decision |
| M-05 | Log out, register a new account | New private workspace with sample data; demo data not visible |
