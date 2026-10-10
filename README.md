# Kiln Web

Admin/web dashboard for Kiln — ceramics inventory, sales, and order management. Companion to the `kiln-mobile` seller app.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Supabase** (PostgreSQL + Auth) — no ORM, direct Supabase JS client
- **TanStack React Query** for data fetching/mutation
- **shadcn/ui** + Radix + Tailwind
- `next-intl` for i18n (`/en` locale prefix)

## Getting Started

```bash
npm run dev       # dev server, localhost:3000
npm run build     # production build
npm run lint      # ESLint
```

No test suite configured.

### Environment Variables

Create `.env.local`:

```sh
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Architecture

### Routing

- Pages live under `app/(dashboard)/` (auth-protected route group)
- `middleware.ts` enforces: `/en` locale prefix on non-API paths, auth redirect to `/en/login`, admin-only access to `/admin/*` via DB role check
- Auth routes: `app/(auth)/login`, `app/(auth)/signup`

### Supabase Clients

Two server-side clients in `lib/supabase/server.ts`:

- `createClient()` — anon key + session cookie, respects RLS
- `createServiceClient()` — service role key, bypasses RLS (admin ops)

Client-side: `lib/supabase/client.ts` → `createBrowserClient()`.

### API Routes Pattern

1. `requireAdmin()` for write operations (403 if not admin)
2. `createClient()` for reads (RLS applies), `createServiceClient()` for admin writes
3. Reads go through `vw_ceramics_inventory` view, never the raw `ceramics` table

### Database

Schema in `supabase/schema.sql` (run manually in Supabase SQL editor).

Key decisions:

- Stock is never a column — `current_stock = SUM(stock_entries.quantity) - SUM(sales.quantity)`, computed in `vw_ceramics_inventory`
- `stock_entries.entry_type` ∈ `{Restock, Adjustment, Return}`; `direction` ∈ `{add, remove}`; `reason` required only for `Adjustment`
- `ceramic_types` encodes brand + size + finish + unit + price; ceramics reference a type
- `get_my_role()` SQL function avoids RLS recursion
- One-admin constraint via partial unique index on `user_profiles.role`
- Two sale-creation paths: direct POS-style sale (`POST /api/sales/sync`, mobile "Sell" tab, `requireSeller()`-gated) and `orders` → admin-approval workflow (`approve_order` RPC writes `sales` at approval time)
- `returns`/`return_items` — partial per-line-item returns against an approved order, admin-recorded on web only; restores stock via a `Return` stock entry without touching the original `sales` row

### Shared UI Components

Always prefer these over inline equivalents:

| Component | File | Purpose |
| --- | --- | --- |
| `ProductImage` | `components/product-image.tsx` | Image wrapper with shimmer-on-load + error fallback |
| `StockBadge` | `components/stock-badge.tsx` | Stock status badge (In/Low/Out), `size="sm"` for tables |
| `ConfirmDialog` | `components/confirm-dialog.tsx` | Replaces `confirm()`, supports `destructive` prop |

Never use `confirm()` / `alert()` / raw `<img>`.

### Data Flow (Ceramics)

```text
vw_ceramics_inventory  ←  ceramics + ceramic_types + brands + finishes + stock_entries + sales
        ↓
GET /api/ceramics  →  formatted JSON (camelCase, _id alias for id)
        ↓
React Query cache  →  UI components
```

### Ethiopian Calendar

`lib/ethiopian-calendar.ts` + `ethiopian-date` handle ET↔Gregorian conversion, used in `POST /api/sales/import`.

### Auth & Roles

- Roles: `admin` (full access), `seller` (record sales/orders, view catalog/stock), `viewer` (read-only)
- RLS grants admin ALL / public SELECT; writes require `get_my_role() = 'admin'`
- Seller writes (direct sales, order submission) bypass RLS via API routes gated by `requireSeller()` using the service role client
- `requireAdmin()` / `requireSeller()` in `lib/auth.ts` resolve the user from session cookie (web) or `Authorization: Bearer` token (mobile)
- `user_profiles` row auto-created on signup via `handle_new_user()` trigger
- Session inactivity timeout: `hooks/use-session-timeout.ts`
