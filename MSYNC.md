# mSync

mSync forwards bank SMS ("money received") from paired Android phones so
payments show up in the Kiln dashboard without calling the bank. It is built to
be lifted into its own service when a second app needs it. Today the server
part lives inside kiln-web; the phone app is its own repo
(`~/Documents/dev/personal/msync/msync-mobile`).

It is a cross-check signal, not proof of payment: SMS can be spoofed, and the
bank statement stays the final word. No matching against orders.

## Boundaries (enforced)

| Part | Where | Rule |
| --- | --- | --- |
| Core logic | `lib/msync/*` | Imports nothing from Kiln (ESLint `no-restricted-imports`). Owns its DB client (`db.ts`). |
| Phone API | `app/api/msync/v1/*` | Thin routes over `lib/msync`. Moves with it. |
| Data | `msync_devices`, `msync_messages` (migration 0015) | `tenant` on every row, no foreign keys into Kiln tables. |
| Host doorway | `lib/msync/client.ts` (server), `lib/msync/live.ts` (browser) | The only mSync files Kiln may import (ESLint). |
| Host glue | `lib/msync-tenant.ts`, `app/api/admin/msync/*`, `app/(dashboard)/admin/payments` | Kiln's side: which tenant it is, admin auth, the page. |

The RLS read policies use Kiln's `get_my_role()`; a standalone service would
replace them with its own API auth.

## Phone API (v1)

All JSON over HTTPS. Phones get the server URL from the person pairing them.

- `POST /api/msync/v1/pair` `{ code, appVersion? }` →
  `{ deviceId, tenant, label, key, senders }`. Code: 8 chars from the dashboard
  (Payments → Add phone), single use, 10 minutes. Wrong/expired → 400.
- `POST /api/msync/v1/messages` with `Authorization: Bearer msk_…`
  `{ messages: [{ sender, body, receivedAt }] }` (≤100) → `{ stored, duplicates }`.
  Retry-safe: the same SMS (sender + body) is stored once per tenant, and a
  parsed bank reference is unique per tenant. 401 = unknown/revoked key: stop
  and ask to re-pair.
- `POST /api/msync/v1/heartbeat` with the key `{ appVersion?, queued? }` →
  `{ ok, label, senders }`. Every ~15 min; the dashboard flags a phone silent >40 min.

Keys are `msk_` + 32 random bytes; only their SHA-256 is stored. Removing a
phone in the dashboard revokes it immediately.

## Parsing

Phones send raw text from bank senders only; the sender list
(`BANK_SENDERS` in `parse.ts`) reaches phones on pairing and every heartbeat. `lib/msync/parse.ts` holds one
parser per bank (sender id + text → amount, payer, reference). Unrecognised
messages are stored as `unparsed` and shown with their raw text. Adding or
fixing a bank never needs a phone update.

## Splitting into its own service

1. New project (e.g. `msync-server`): copy `lib/msync` and `app/api/msync`,
   its own Supabase project, migration 0015 minus the `get_my_role()` policies.
2. Add per-app API keys (one per tenant) for host reads; move
   `listPayments` / `listPhones` / `createPairing` / `revokeDevice` behind
   `GET/POST /api/msync/v1/admin/*`.
3. Copy the data (`msync_devices`, `msync_messages`).
4. In Kiln, rewrite `lib/msync/client.ts` as HTTP calls and `live.ts` as a
   webhook or polling. Nothing else in Kiln changes.
5. Phones: re-pair against the new server URL (or ship an update that points
   there; keys keep working because the hashes moved with the data).
