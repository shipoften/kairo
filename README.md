# Kairo

> Publish or earn. One account.

A task marketplace for X (Twitter) promotion. Advertisers post tasks; publishers and traffic owners complete them. One account can switch freely between **posting** and **accepting** tasks.

Built as a Turborepo monorepo with Bun.

## Overview

| Pain point | How Kairo addresses it |
|------------|------------------------|
| Hard to find reliable promoters | Public task board with transparent pricing and quotas |
| Hard to verify actions | Structured proof submission and review workflow |
| Messy settlements | Pre-funded escrow: freeze on publish, release on approval |
| Split identities | Single wallet and account for both sides |

**MVP task types:** `x_follow`, `x_like`, `x_repost`, `x_post`, `cpa_register`, `custom`

Product and architecture docs (Chinese): [`docs/`](./docs/README.md).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Monorepo | Turborepo + Bun workspaces |
| Web | Next.js 16, React 19, Tailwind CSS 4, next-intl (`en` / `zh`) |
| API | Bun + Elysia, Zod validation, `/v1` prefix |
| Database | PostgreSQL + Drizzle ORM |

## Repository Layout

```
apps/web         Next.js frontend (SEO landing + app)
apps/api         Bun API (auth, tasks, wallet, admin, referrals)
packages/shared  Shared constants, enums, and types
packages/db      Drizzle schema, migrations, and client
docs             Product and technical design (Chinese)
```

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.14
- PostgreSQL 16+ (local install or Docker)

## Quick Start

```bash
cp .env.example .env
# Edit DATABASE_URL and SESSION_SECRET at minimum

bun install
bun run db:setup
bun run dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:5180 |
| API health | http://localhost:5181/health |

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (database name: `xs_share`) |
| `NEXT_PUBLIC_APP_URL` | Public web URL |
| `NEXT_PUBLIC_API_URL` | Public API URL |
| `API_PORT` | API listen port (default `5181`) |
| `WEB_ORIGIN` | Allowed CORS origin for the API |
| `SESSION_SECRET` | Session signing secret (use a long random string) |
| `AUTH_DEV_LOGIN` | Enable dev login for local / staging (`true` / `false`) |
| `COOKIE_SECURE` | Set `Secure` on session cookies (`false` for local HTTP) |
| `OAUTH_CALLBACK_BASE_URL` | OAuth redirect base (e.g. `http://localhost:5181`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X OAuth (optional) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | Telegram widget bot username (optional) |
| `CHAIN_ADAPTER` | `mock` (default) or `tron` for real TRC20 deposit scanning |
| `TRON_API_URL` | TronGrid / full-node HTTP base (default `https://api.trongrid.io`) |
| `TRON_API_KEY` | Optional TronGrid API key |
| `TRON_USDT_CONTRACT` | USDT TRC20 contract (default mainnet USDT) |
| `TRON_DEPOSIT_XPUB` | Watch-only extended public key exported at `m/44'/195'/0'/0` (required when `CHAIN_ADAPTER=tron`; no private key / mnemonic on server) |
| `NEXT_PUBLIC_TRON_USDT_CONTRACT` | USDT TRC20 contract for Connect Wallet transfers in web (defaults to mainnet USDT) |
| `DISABLE_WORKERS` | Disable background workers when `true` |

OAuth is optional for local development when `AUTH_DEV_LOGIN=true`.

## Database Setup

`DATABASE_URL` must point to a PostgreSQL instance. The database user needs permission to create databases, or connect as a superuser to `postgres` and run `db:ensure`.

```bash
# One-shot: create database (if missing) + apply migrations
bun run db:setup

# Step by step
bun run db:ensure    # CREATE DATABASE xs_share (skipped if exists)
bun run db:migrate   # drizzle-kit migrate
bun run db:verify    # Verify 15 tables + migration history

# After schema changes
bun run db:generate  # Generate migration from packages/db/src/schema.ts
bun run db:migrate
```

Current migration: `packages/db/drizzle/0000_lovely_morlun.sql` (15 tables). If `drizzle-kit generate` prints `No schema changes`, the schema and database are in sync.

Open Drizzle Studio:

```bash
bun run db:studio
```

## Authentication

- **Dev Login** (`AUTH_DEV_LOGIN=true`): quick sign-in for development and internal testing.
- **OAuth**: configure Google, X, and/or Telegram; login buttons appear on the sign-in page when credentials are set.

To access the admin panel, set a user's `role` to `admin` in the database, or run:

```bash
bun run seed:admin
```

Then sign in via **Dev Login** with external id `dev-admin` (display name `Admin`) and open `/admin`.

## Docker

Run the full stack (PostgreSQL + API + Web):

```bash
docker compose up --build
```

Services use the same ports as local dev (`5180` / `5181` / `5432`). Run migrations against the containerized database before first use:

```bash
bun run db:setup
```

## Scripts

```bash
bun run dev          # Start web + api in development
bun run build        # Production build (all packages)
bun run lint         # Lint all packages
bun run typecheck    # Type-check all packages
bun run test         # API unit + integration tests (requires DATABASE_URL)
bun run test:e2e     # Playwright E2E tests (apps/web)
bun run db:setup     # Ensure database + migrate
bun run db:verify    # Validate schema against migrations
bun run db:generate  # Generate new Drizzle migration
bun run db:migrate   # Apply pending migrations
bun run db:studio    # Drizzle Studio
```

## Testing

```bash
# Schema verification
bun run db:verify

# API tests (integration tests need DATABASE_URL)
bun test apps/api

# End-to-end (Playwright)
bun run test:e2e
```

## MVP Flow

End-to-end path covered by the current implementation:

```
Sign in (Dev Login / OAuth)
  -> Top up (TRC20 unique address; mock adapter or admin simulate in local;
       set CHAIN_ADAPTER=tron + TRON_DEPOSIT_XPUB for real scan-to-credit)
  -> Post task (balance frozen)
  -> Second account applies and submits proof
  -> Review and settle
  -> Withdraw (admin approves, pays from hot wallet manually, marks paid with txHash)
  -> Referral commission in the same transaction
```

**Withdrawals:** MVP does not auto-broadcast. After approve, ops send `netPayoutMicros` from the platform hot wallet, then mark paid with the on-chain tx hash.

**Frontend data flow:** Server Components for reads, client islands for mutations, `router.refresh()` for updates. No global state library.

See [`docs/07-MVP范围.md`](./docs/07-MVP范围.md) and [`docs/10-功能收口检查表.md`](./docs/10-功能收口检查表.md) for the full acceptance checklist.

## API Conventions

- Base path: `/v1`
- Auth: session cookie (`credentials: "include"` from the web app)
- Errors: `{ code, message, messageKey }` — the web app maps `messageKey` to i18n strings
- Shared enums and error codes live in `@xs-share/shared`

## License

Private — not for public distribution unless otherwise stated.
