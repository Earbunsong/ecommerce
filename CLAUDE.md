# CLAUDE.md — ShopKH

Single-store e-commerce web app. Customers browse, order, pay, and track orders; admins manage products, orders, and customers.

## Read these first

- `docs/01-project-proposal.md` — scope (in scope / out of scope). Do not build out-of-scope features.
- `docs/02-system-architecture.md` — layers, API endpoints, design decisions
- `docs/03-system-flowcharts.md` — business processes and order status rules
- `docs/04-erd.md` — database schema (source of truth for `db/schema.ts`)
- `docs/05-implementation-plan.md` — current phase and task checklist

If code and docs disagree, stop and ask which one is correct. If you change a design decision, update the doc in the same change.

## Stack

- Monorepo: pnpm workspaces — `apps/api`, `apps/web`
- API: Hono on Node.js, TypeScript strict, Zod (`@hono/zod-validator`), Drizzle ORM, PostgreSQL 16
- Web: React + Vite + TypeScript, React Router, TanStack Query, Tailwind, shadcn/ui, Hono RPC client (`hc<AppType>`)
- Tests: Vitest (unit/integration), Playwright (E2E)

## Commands

- Node 22 (`.nvmrc`; `nvm use 22`). TypeScript is pinned to 6.0.x because typescript-eslint does not support 7 yet
- `pnpm dev` — run API (:3000) and web (:5173; Vite moves to the next free port if 5173 is taken)
- `docker compose up -d` — start PostgreSQL 16 on host port **5433** (`shopkh` and `shopkh_test`)
- `pnpm --filter api db:generate` / `db:migrate` / `db:seed` (dev only, never production) / `db:create-admin` (production admin from `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- `pnpm test` — all tests against the `shopkh_test` database; `pnpm --filter api test` — API only
- Concurrency tests must use real separate connections (`Promise.all` through the API), never one shared transaction
- `pnpm lint` and `pnpm typecheck` must pass before a phase is done

## Architecture rules

- API module layout: `modules/<name>/<name>.routes.ts | .service.ts | .repository.ts | .schemas.ts`
- Routes: validate with Zod, call service, return JSON. No business logic, no DB queries.
- Services: business logic, no Hono context, no HTTP status codes. Throw `AppError(code, message)` for expected failures; the error handler maps codes to HTTP status (architecture §4.10). Services own transactions: `db.transaction(tx => ...)`, passing `tx` to repositories.
- Repositories: Drizzle queries only. Accept an optional `tx`; never start their own transaction.
- `app.ts` must chain routes so `export type AppType = typeof routes` works for the RPC client.
- Web: server data via TanStack Query hooks in `features/<name>/`; no `fetch` calls inside components.

## Business rules (never break these)

1. Money is integer cents (USD). Never use floats for money.
2. Prices and totals are always calculated on the server from DB values. Ignore any price sent by the client.
3. Stock is reserved at order creation with an atomic `UPDATE ... WHERE stock_quantity >= qty` inside the checkout transaction. Stock must never go negative.
4. Every move to `cancelled` restores stock, sets `cancel_reason`, and — if the order has a successful payment — sets `needs_refund = true`, all in the same transaction.
5. Order status changes must follow the transitions in flowchart 5 and insert `order_status_history`. Every status change is a conditional update (`WHERE status = :expectedFrom`); if 0 rows change, stop and touch nothing else.
6. `order_items` store product name and unit price snapshots; orders store shipping address snapshots.
7. Payment webhooks are idempotent: mark success with `UPDATE ... WHERE provider_txn_id = ? AND status <> 'success'`; 0 rows → return 200, change nothing. The mock payment route exists only when `ENABLE_MOCK_PAYMENTS=true`.
8. Customers can only access their own cart, addresses, and orders — always use `user_id` from the auth token.
9. Products are deactivated, never hard-deleted.
10. Never return `password_hash`. Auth token only in an httpOnly cookie. `authMiddleware` loads the user from the DB on every request and rejects inactive users.
11. Checkout locks the cart row `FOR UPDATE` and updates products sorted by id.
12. Default address and primary image are switched in one transaction (clear old, then set new); partial unique indexes reject a second one.
13. Shop queries show a product only if the product, its category, and the category's parent are all active.

## How to work with me

- Before implementing, explain the business logic and the "why", list the files you'll touch, and wait for my OK.
- Work one phase/task at a time. Do not start the next phase on your own.
- Prefer small, targeted changes. For fixes, show before/after for each change.
- For bugs: find and explain the root cause first, then fix, then add a regression test.
- Do not add new libraries without asking.
- After finishing: run lint, typecheck, and tests; summarize what changed; tick boxes in `docs/05-implementation-plan.md`.
