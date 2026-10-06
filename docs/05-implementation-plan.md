# Implementation Plan — ShopKH (for Claude Code)

Work through **one phase per Claude Code session**. After each phase: run lint, typecheck, and tests, check the app manually, commit, then tick the boxes here. A phase is finished only when its **Done when** line is true.

**Why phases instead of "build the whole app":** a single huge prompt produces a lot of code you can't review, and errors in early layers (database, auth) spread into everything built on top. Small phases mean each layer is verified before the next one depends on it.

## Schedule

The phases fit the 8 development weeks of the proposal timeline (§10, weeks 5–12).

| Week | Phases | Focus |
|---|---|---|
| 5 | 0, 1 | Project setup, database, test infrastructure |
| 6 | 2, 3 | Auth, catalog, admin products |
| 7 | 4, 5a, 5b | Addresses, cart, checkout, order rules |
| 8 | 6, 7 | Payments, reviews, admin orders and reports (backend complete) |
| 9 | 8, 9 | Frontend foundation, shop pages |
| 10 | 10, 11 | Checkout and account pages, admin pages |
| 11 | 12a | E2E tests, responsive check, security review, bug fixing |
| 12 | 12b | Deployment, documentation, presentation |
| After approval | 13 | Real payment gateway |

**Buffer:** if week 7 or 8 slips, use week 11 first. Reviews (Phase 7, Phase 10 "Write review") are the first feature to move to Future Work.

---

## Phase 0 — Project setup (week 5)
- [x] Git repository, `.gitignore` (`node_modules`, `.env`, `uploads/`, build output)
- [x] pnpm workspace monorepo: `apps/api`, `apps/web`
- [x] TypeScript strict mode, ESLint, Prettier
- [x] `docker-compose.yml` with PostgreSQL 16: databases `shopkh` (dev) and `shopkh_test` (tests)
- [x] API: Hono on `@hono/node-server`, request logger, `GET /api/health`
- [x] Web: Vite + React + TS, Tailwind, shadcn/ui, React Router, TanStack Query
- [x] Vite `server.proxy` forwards `/api` to `:3000` (same-site cookies, architecture §8)
- [x] `api-client.ts` with `hc<AppType>`; the home page calls `/api/health` through it
- [x] Root scripts: `pnpm dev` (both apps), `pnpm test`, `pnpm lint`, `pnpm typecheck`
- [x] API scripts (empty for now, filled in Phase 1): `db:generate`, `db:migrate`, `db:seed`, `db:create-admin`
- [ ] CI workflow (GitHub Actions): on every push and pull request, start PostgreSQL, run lint, typecheck, and tests — workflow written; tick after the first push shows green
- [x] `.env.example` for API and web

**Done when:** `pnpm dev` starts both apps; the web page shows the API health response fetched through `hc<AppType>` (renaming a field in the API response causes a web type error); CI is green.

## Phase 1 — Database and test infrastructure (week 5)
- [ ] Drizzle schema matching `docs/04-erd.md` exactly (tables, enums, CHECK constraints, partial unique indexes, FK indexes, explicit `ON DELETE`)
- [ ] `order_number_seq` sequence (ERD §4.2)
- [ ] Migrations generated and applied
- [ ] Env config validated with Zod (`config/env.ts`)
- [ ] **Test infrastructure**
  - [ ] Tests run against `shopkh_test`; `pnpm test` applies migrations to it first
  - [ ] All tables are emptied (`TRUNCATE ... CASCADE`) before each test file
  - [ ] Test helpers: `createUser`, `createAdmin`, `createCategory`, `createProduct`, `createOrder`, `loginAs` (returns a cookie)
  - [ ] Concurrency helper: runs N requests at the same time with `Promise.all`, each through the real API and the connection pool (**not** inside one shared transaction, which would hide race conditions)
- [ ] **Demo seed** (`db:seed`, development only; refuses to run when `NODE_ENV=production`):
  - [ ] 1 admin and 2 customers with documented demo passwords
  - [ ] 5 categories, including at least 1 sub-category and 1 inactive category
  - [ ] 30 products with placeholder images stored in the repo, including 1 inactive, 1 out of stock, and 2 low-stock (≤ 5) products
  - [ ] 1 delivered order (so a review can be written), 1 cancelled paid order with `needs_refund = true`
- [ ] **Production admin** (`db:create-admin`): creates one admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars; fails if the email exists
- [ ] Tests: constraints reject bad rows (negative stock, wrong line total, wrong order total, second default address, second primary image, second pending payment, second successful payment, cancelled order without reason, online order without `expires_at`)

**Done when:** `pnpm db:migrate && pnpm db:seed` works on an empty database; the constraint tests pass; `db:seed` refuses to run with `NODE_ENV=production`.

## Phase 2 — Backend foundation + Auth (week 6)
- [ ] `AppError(code, message)` + global error handler with the code → HTTP status table (architecture §4.10)
- [ ] Secure headers middleware (`hono/secure-headers`)
- [ ] Auth module: register (creates cart, sets cookie), login (password checked before `is_active`), logout, me; emails lowercased
- [ ] `authMiddleware` (loads user from DB every request, rejects inactive), `requireAdmin`
- [ ] Rate limiting on login/register
- [ ] Tests: register logs in, duplicate email (incl. different case), wrong password, inactive user gets `ACCOUNT_DISABLED` only with correct password, user deactivated while logged in is rejected, admin guard, rate limit returns 429, `password_hash` never in any response

**Done when:** all auth tests pass; every error response has the §4.10 shape.

## Phase 3 — Catalog + Admin products (week 6)
- [ ] Public: category tree, product list (search/filter/sort/pagination; parent category includes sub-categories; hidden if category inactive), product detail
- [ ] Admin: product CRUD, stock adjustments by `delta` (atomic, never negative), categories CRUD (max 2 levels)
- [ ] Image upload with storage interface (local driver first); reorder, set primary, delete
- [ ] Tests:
  - [ ] filters, sort, pagination shape `{ items, page, pageSize, total }`
  - [ ] inactive product hidden; product hidden when its category or parent category is inactive; parent category filter includes sub-category products
  - [ ] non-admin rejected from admin routes
  - [ ] stock adjustment cannot go negative
  - [ ] upload rejects non-image files and files over 5 MB; first image becomes primary; deleting the primary promotes the next image
  - [ ] category cannot be its own parent; third level rejected

**Done when:** all catalog tests pass; the seeded products can be browsed and filtered through the API.

## Phase 4 — Addresses + Cart (week 7)
- [ ] Address CRUD + set default (one transaction: clear old, set new); deleting the default address leaves the customer with **no default** until they choose one
- [ ] Cart endpoints; stock check on add/update; `issue` field for inactive / insufficient-stock items
- [ ] Tests: ownership (user A cannot touch user B's cart/address, gets `NOT_FOUND`), stock limits, adding an inactive product rejected, `issue` field after a product is deactivated or stock drops, second default address impossible, deleting the default leaves no default

**Done when:** all address and cart tests pass.

## Phase 5a — Checkout (week 7, most critical)
- [ ] `POST /orders` in one transaction (flowchart 3), with the cart row locked `FOR UPDATE`; address ownership check; status history row on creation; COD payment row only
- [ ] Atomic stock decrement, products sorted by id; rollback on any failure
- [ ] Server-side totals, shipping fee rule, order number from `order_number_seq` (Phnom Penh date)
- [ ] Order item + shipping address snapshots (`ship_street`, `ship_district`, `ship_province`)
- [ ] Tests:
  - [ ] concurrent checkout of the last item: only one succeeds, stock ends at 0
  - [ ] double-submitted checkout creates one order; the second gets `CART_EMPTY`
  - [ ] price sent by the client is ignored
  - [ ] another user's `addressId` returns `NOT_FOUND`
  - [ ] free shipping exactly at `FREE_SHIPPING_THRESHOLD_CENTS`, paid shipping 1 cent below it
  - [ ] order numbers unique under 20 simultaneous checkouts
  - [ ] snapshots unchanged after the product and address are edited

**Done when:** all checkout tests pass, and the concurrency tests pass **20 times in a row** (Vitest's `repeats: 20` test option on those tests, or run the file 20 times in a shell loop).

## Phase 5b — Order rules, cancel, expiry (week 7)
- [ ] Status transition rules as conditional updates (`WHERE status = :expectedFrom`) + `order_status_history` (flowchart 5, architecture §4.5)
- [ ] Customer cancel → restore stock, `cancel_reason`, `needs_refund` if paid (flowchart 10)
- [ ] Expiry job: one order per transaction with `LIMIT 1 FOR UPDATE SKIP LOCKED` (flowchart 6) + lazy expiry on read/initiate
- [ ] Tests (set `expires_at` in the past directly in the database; do not wait or use fake timers, because PostgreSQL's `now()` is not affected by them):
  - [ ] invalid transitions rejected with `INVALID_STATUS_TRANSITION`
  - [ ] cancel restores stock and sets `cancel_reason`
  - [ ] customer cannot cancel from `processing`
  - [ ] expiry restores stock, sets `payment_timeout`, marks pending payments `expired`
  - [ ] two expiry jobs running at the same time cancel each order once
  - [ ] lazy expiry: reading an expired pending order returns it as cancelled

**Done when:** all order-rule tests pass, and the concurrency tests pass 20 times in a row.

## Phase 6 — Payments (week 8)
- [ ] `PaymentProvider` interface; `CodProvider`, `MockProvider`
- [ ] Initiate payment (ownership, online, pending, not expired; reuses an existing pending payment), webhook endpoint (outside auth/CORS), mock-complete endpoint (only when `ENABLE_MOCK_PAYMENTS=true`)
- [ ] Idempotency with conditional update on `provider_txn_id` + partial unique indexes on pending and successful payments
- [ ] Tests: duplicate webhook, two identical webhooks at the same time, payment after expiry (order stays cancelled, `needs_refund = true`), webhook racing the expiry job, failed then success, late failed after success is ignored, initiate twice returns the same payment, two initiate calls at the same time create one pending payment, second successful payment sets `needs_refund` and returns 200, unknown `provider_txn_id` returns 200, mock route returns 404 when `ENABLE_MOCK_PAYMENTS` is not `true`

**Done when:** all payment tests pass, and the concurrency tests pass 20 times in a row.

## Phase 7 — Reviews + Admin orders, customers, reports (week 8)
- [ ] Reviews (active product, delivered-order rule, one per product, rating summary recalculated in the same transaction; flowchart 8)
- [ ] Admin order list/detail/status update (flowchart 9; COD payment success on delivered); `needsRefund` filter; mark refund handled
- [ ] Admin customers list + activate/deactivate
- [ ] Reports summary endpoint (`from`/`to`, Asia/Phnom_Penh; revenue per ERD §4.3)
- [ ] Tests:
  - [ ] review rejected without a delivered order, for an inactive product, and on a second attempt; two simultaneous submits create one review; `avg_rating` and `review_count` correct
  - [ ] admin can only make allowed transitions; `delivered` marks the COD payment `success` in the same transaction
  - [ ] admin cancel of a paid order sets `needs_refund`; mark refund handled clears it and records who and when
  - [ ] deactivated customer is rejected on the next request
  - [ ] revenue excludes cancelled and unpaid orders, includes delivered COD orders
  - [ ] **time zone boundary:** an order created at 23:30 Phnom Penh time (16:30 UTC) counts on that Phnom Penh day; one at 00:30 Phnom Penh time counts on the next day
  - [ ] low-stock list shows products with stock ≤ 5

**Done when:** all tests pass; the full backend (every endpoint in architecture §6) works through the API.

## Phase 8 — Frontend foundation (week 9)
- [ ] `api-client.ts` with `credentials: 'include'`; TanStack Query hooks per feature
- [ ] ShopLayout (header, cart badge, footer), AdminLayout (sidebar)
- [ ] Auth pages, protected routes, admin-only routes
- [ ] Global error/toast handling (shows `error.message`; `UNAUTHENTICATED` redirects to login)

**Done when:** a customer can register, log in, and log out in the browser; an admin is sent to the admin layout; a customer cannot open admin pages.

## Phase 9 — Shop pages (week 9)
- [ ] Home, Product list (filters in URL query), Product detail, Cart (shows item `issue` and blocks checkout)

**Done when:** a guest can browse, search, filter, and open products; a logged-in customer can manage the cart; the pages work at mobile width.

## Phase 10 — Checkout & account (week 10)
- [ ] Checkout (cart issues block checkout; default address preselected if there is one), Payment page (mock; polls order every 3 s, flowchart 11), Order success, Order history, Order detail with status timeline and cancel button, Addresses, Profile, Write review

**Done when:** a customer can complete a COD order and a mock online payment in the browser, see the status timeline, and cancel an eligible order.

## Phase 11 — Admin pages (week 10)
- [ ] Dashboard, Products (list/form/images), Categories, Orders (list/detail/status, `needsRefund` filter, mark refund handled), Customers

**Done when:** an admin can manage a product end to end, process an order from `pending` to `delivered`, and see it in the dashboard.

## Phase 12a — Testing and hardening (week 11)
- [ ] E2E (Playwright), test environment with `ORDER_PAYMENT_TIMEOUT_MINUTES=1` and `ENABLE_MOCK_PAYMENTS=true`:
  - [ ] happy path: register → add to cart → checkout → mock pay → admin ships → delivered → review
  - [ ] COD order: checkout → admin confirms → ships → delivered (payment `success`)
  - [ ] customer cancels a paid order → admin sees it in `needsRefund` → marks refund handled
  - [ ] unpaid online order expires → stock returns → payment page shows "expired"
  - [ ] admin deactivates a customer → the customer's next action sends them to login
- [ ] Responsive check on mobile (375 px), tablet, desktop
- [ ] Security review (`/security-review`) against the architecture §7 checklist
- [ ] Fix bugs found; each fix gets a regression test

**Done when:** all unit, integration, and E2E tests pass in CI; the security review has no open high-severity findings.

## Phase 12b — Deployment and documentation (week 12)
- [ ] Deploy API, web, database (architecture §8)
- [ ] Web host forwards `/api/*` to the API (same-site rule); verify login works in production
- [ ] Production env vars; `ENABLE_MOCK_PAYMENTS` off when real payments are used (on only for a demo deployment)
- [ ] Migrations run as part of each deploy (`db:migrate`); **never** run `db:seed` in production
- [ ] Create the admin with `db:create-admin` (`ADMIN_EMAIL`, `ADMIN_PASSWORD` set only for that run)
- [ ] HTTPS only; database automatic backups enabled
- [ ] README with setup instructions; user guide; final report

**Done when:** the live site works end to end (register, order, admin processes it) and the README lets someone else run the project locally.

## Phase 13 — Real payment gateway (after merchant approval)
- [ ] `AbaPaywayProvider` and/or `BakongProvider` (architecture §4.8)
- [ ] Confirm from official documentation whether the provider sends webhooks or must be polled
- [ ] If polled: payment polling job using `checkStatus` (`jobs/poll-payments.ts`)
- [ ] Sandbox tests for success, failure, duplicate callback, and late payment
- [ ] Turn off `ENABLE_MOCK_PAYMENTS` in production

**Done when:** a real sandbox payment confirms an order, and all Phase 6 tests still pass.

---

## Prompt templates for Claude Code

### Starting a phase
```
Read CLAUDE.md and docs/05-implementation-plan.md.
We are doing Phase <N>: <name>.
Before writing code, explain the plan: which files you will create or change,
the business rules involved and why, and anything in the docs that is unclear.
Wait for my OK, then implement. Write the tests listed for this phase and run them.
When done, run lint, typecheck, and tests, check the "Done when" line,
summarize what changed, and tick the boxes in the plan.
Do not start the next phase.
```

### Fixing a bug
```
Bug: <what happens>
Expected: <what should happen>
Steps to reproduce: <1, 2, 3>
Error / logs: <paste>
Where I think it is: <file or page, if known>

First find and explain the root cause. Do not change code yet.
Then propose the smallest fix, showing before/after for each change.
After I approve, apply it, add a test that fails without the fix,
and run the related tests.
```

### Reviewing work
```
Review the code changed in this phase against CLAUDE.md business rules,
docs/02-system-architecture.md, docs/03-system-flowcharts.md, and
docs/04-erd.md. List problems by severity (security, data integrity,
bugs, style). Do not fix anything yet.
```
