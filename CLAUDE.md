# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:3000)
npm run build     # production build
npm run lint      # ESLint
```

No test suite is configured.

## Environment Variables

Required in `.env.local`:

```sh
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Architecture

**Next.js 15 App Router** with Supabase (PostgreSQL + Auth). No ORM — all DB access is via Supabase JS client.

### Routing

- All pages live under `app/(dashboard)/` (auth-protected route group)
- Middleware (`middleware.ts`) enforces:
  1. `/en` locale prefix on all non-API paths
  2. Auth redirect to `/en/login` for unauthenticated users
  3. Admin-only access to `/admin/*` routes via DB role check
- Auth routes: `app/(auth)/login`, `app/(auth)/signup`

### Supabase Clients

Two server-side clients in `lib/supabase/server.ts`:

- `createClient()` — uses anon key + session cookie (respects RLS)
- `createServiceClient()` — uses service role key (bypasses RLS, for admin ops)

Client-side: `lib/supabase/client.ts` → `createBrowserClient()`.

### API Routes Pattern

All routes follow this pattern:

1. Call `requireAdmin()` for write operations (returns `null` if not admin → 403)
2. Use `createClient()` for reads (RLS applies), `createServiceClient()` for admin writes
3. Query `vw_ceramics_inventory` view for ceramic data (never the raw `ceramics` table for reads)

### Database

Schema lives in `supabase/schema.sql` (run manually in Supabase SQL editor).

Key design decisions:

- **Stock is never a column** — `current_stock = SUM(stock_entries.quantity) - SUM(sales.quantity)`, computed in `vw_ceramics_inventory`
- `stock_entries.entry_type` ∈ `{Initial, Restock, Adjustment}`
- `ceramic_types` encodes brand + size + finish + unit + price; ceramics reference a type
- `get_my_role()` SQL function avoids RLS recursion when checking roles
- One-admin constraint enforced via partial unique index: `CREATE UNIQUE INDEX one_admin_only ON user_profiles (role) WHERE (role = 'admin')`

### Shared UI Components

Three components in `components/` used across all pages — always prefer these over inline equivalents:

| Component | File | Purpose |
| --- | --- | --- |
| `ProductImage` | `components/product-image.tsx` | Next.js Image wrapper with shimmer-on-load and error fallback. Replaces raw `<img>` or `next/image` + manual skeleton. |
| `StockBadge` | `components/stock-badge.tsx` | Semantic stock status badge (`In Stock` / `Low Stock` / `Out of Stock`) from a numeric stock value. Has `size="sm"` prop for table rows. |
| `ConfirmDialog` | `components/confirm-dialog.tsx` | `AlertDialog`-based confirmation. Replaces all `confirm()` calls. Accepts `destructive` prop for red confirm button. |

**Never use `confirm()` / `alert()` / raw `<img>` for product images.** These are all replaced.

shadcn components available: see `components/ui/`. Includes `select.tsx` and `alert-dialog.tsx` in addition to the base set.

### Data Flow (Ceramics)

```text
vw_ceramics_inventory  ←  ceramics + ceramic_types + brands + finishes + stock_entries + sales
        ↓
GET /api/ceramics  →  formatted JSON (camelCase, _id alias for id)
        ↓
React Query cache  →  UI components
```

Frontend uses **TanStack React Query** for all data fetching/mutation. No Redux store is actively used despite the dependency.

### Ethiopian Calendar

`lib/ethiopian-calendar.ts` + `ethiopian-date` package handle ET↔Gregorian conversion. Used in `POST /api/sales/import` for batch imports with ET dates.

### Auth & Roles

- Two roles: `admin`, `viewer`
- RLS: public SELECT on all tables; INSERT/UPDATE/DELETE require `get_my_role() = 'admin'`
- `user_profiles` row auto-created on signup via `handle_new_user()` trigger
- Session inactivity timeout handled in `hooks/use-session-timeout.ts`
