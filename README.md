# FlowBoard Internal SaaS

Production-ready internal SaaS for ticket and team capacity management using **Next.js 16 + Supabase Cloud**.

## Features implemented

- Email/password authentication with Supabase Auth.
- Strict route protection using **Next.js Proxy** and server-side session checks.
- Multi-company (multi-tenant) data model with RLS.
- Company roles: `COMPANY_ADMIN`, `TICKET_CREATOR`, `READER`.
- Global role: `SUPER_ADMIN`.
- Core routes:
  - `/login`
  - `/dashboard`
  - `/tickets`
  - `/tickets/new`
  - `/projects`
  - `/team`
  - `/calendar`
  - `/super-admin`
- Ticket Kanban board.
- Structured ticket creation form.
- Team capacity calculations and overload indicators.
- Urgent ticket highlighting.
- Super-admin controls (company creation + membership assignment).

---

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase Cloud project (already linked in this implementation)
- (Optional, for DB terminal workflows) Supabase CLI and psql

---

## Install

```bash
npm install
```

---

## Environment setup

1. Copy example file:

```bash
copy .env.example .env.local
```

2. Fill required values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

> This repository includes `.ENV` and `.env.local` for local development convenience. Never commit private secrets.

---

## Database migrations and seed (Supabase Cloud)

### Option A — Using MCP-applied state (already executed)

The migration `init_schema_multi_tenant_rbac` and seed SQL were already applied to project:

- Project ref: `sxfnhaeeuvzmkuxpqifj`

### Option B — Terminal-only (fresh machine)

1. Install Supabase CLI (if missing).
2. Link project:

```bash
npx supabase link --project-ref sxfnhaeeuvzmkuxpqifj
```

3. Push migrations:

```bash
npx supabase db push
```

4. Run seed SQL (requires direct DB URL):

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

> `SUPABASE_DB_URL` is available in the Supabase project settings (Connection string).

---

## Run app

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Quality commands

```bash
npm run lint
npm run build
npm run test:e2e
```

Optional helpers:

```bash
npm run lint:fix
npm run format
```

---

## Testing notes

Playwright browsers must be installed once:

```bash
npx playwright install
```

---

## Troubleshooting

### 1) "Missing Supabase environment variables"

Ensure `.env.local` contains:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2) Login works but no data appears

Likely causes:

- No memberships assigned to current user.
- Seed skipped because there were no users in `auth.users` when it ran.

Fix:

- Sign in once to generate profile.
- Use `/super-admin` with a super admin account to assign memberships.
- Re-run `supabase/seed.sql`.

### 3) Playwright fails with browser executable missing

Run:

```bash
npx playwright install
```

### 4) RLS denies access unexpectedly

Verify user has either:

- global role `SUPER_ADMIN`, or
- active `company_memberships` in the requested company.

---

## Project structure (high-level)

- `app/` — routes and layouts
- `app/(auth)/login` — auth UI
- `app/(protected)` — protected modules
- `lib/supabase` — SSR/browser/proxy clients
- `lib/auth` — auth context and session logic
- `lib/data` — business data queries
- `supabase/migrations` — SQL schema migrations
- `supabase/seed.sql` — demo data seed
- `tests/e2e` — Playwright tests
