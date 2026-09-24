# Strava integration

**Status:** Phase 1 first slice (connect + last 30 days + list)  
**Date:** 2026-09-23  
**Depends on:** [auth.md](./auth.md) (Google session cookie must already work)

Strava is a **training account**, not a login. The user signs in with Google first. The browser never talks to Strava’s API with tokens; Fastify does. Vite (`:5173`) is still the public origin so the session cookie is first-party on the OAuth callback.

Garmin, Whoop, and TrainingPeaks are not wired. There is no webhook, no pg-boss job, no MapLibre yet. First import is **30 days**, not the 24-month backfill in the plan.

---

## 1. What talks to what

```
Browser (localhost:5173)
  │  POST /api/v1/integrations/strava/connect
  │  GET  /api/v1/integrations/strava/callback?code&state
  │  GET  /api/v1/integrations
  │  GET  /api/v1/activities
  │  POST /api/v1/integrations/:id/resync
  ▼
Vite proxy
  /api/*  →  Fastify :3001  (strip /api)
             /api/v1/integrations/strava/callback
             → /v1/integrations/strava/callback
  ▼
Fastify
  signed cookie  →  Better Auth getSession
  Strava OAuth   →  https://www.strava.com/oauth/*
  Activities     →  GET https://www.strava.com/api/v3/athlete/activities
  ▼
PostgreSQL
  integrations          encrypted tokens, athlete id, last_sync_at
  activities            canonical list rows
  activity_sources      raw Strava summary + fingerprint
```

Callback must hit `:5173`, not `:3001`. Same reason as Google: `SameSite=Lax` cookies are sent on the top-level redirect back from strava.com only if the URL is the Vite origin.

---

## 2. Strava API application (one-time)

[Strava API settings](https://www.strava.com/settings/api). The form field **Authorization Callback Domain** is a **host only**. Do not paste the full redirect URL there.

| Field | Local value |
| --- | --- |
| Website | `http://127.0.0.1:5173` |
| Authorization Callback Domain | `127.0.0.1` |

Then copy **Client ID** and **Client Secret** into `.env`:

```
STRAVA_CLIENT_ID=…
STRAVA_CLIENT_SECRET=…
```

Restart the API after changing `.env` (`tsx watch` does not reload env).

The redirect URI **we send** (not the domain field) is:

`http://127.0.0.1:5173/api/v1/integrations/strava/callback`

Override with `STRAVA_REDIRECT_URI` only if that exact string must differ. It has to stay on `:5173` in dev.

Optional `TOKEN_ENCRYPTION_KEY` is 64 hex chars (32 bytes). If unset, the API derives a key from `SHA-256(BETTER_AUTH_SECRET)`. Fine for local; set a dedicated key before any real deploy.

Connect without Strava env vars → `POST /v1/integrations/strava/connect` returns **503** `{ error: 'Strava is not configured' }`.

---

## 3. Files

| File | Role |
| --- | --- |
| `apps/web/src/routes/app/index.tsx` | Connect button, list, resync, `?strava=` flash messages |
| `apps/web/src/auth/session.ts` | `api` client (`baseUrl: '/api'`) |
| `packages/api-client/src/index.ts` | `connectStrava`, `integrations`, `activities`, `resyncIntegration` |
| `apps/api/src/integrations/routes.ts` | HTTP: connect, callback, list, resync, activities |
| `apps/api/src/integrations/service.ts` | OAuth URL, token exchange, last-month import |
| `apps/api/src/integrations/strava-http.ts` | `fetch` to Strava token + activity list |
| `apps/api/src/integrations/oauth-state.ts` | HMAC `state` bound to `userId`, 15 min TTL |
| `apps/api/src/integrations/kysely-repository.ts` | Postgres upsert |
| `apps/api/src/crypto/tokens.ts` | AES-256-GCM for access/refresh tokens |
| `apps/api/src/integrations/factory.ts` | Wires env + Kysely + HTTP client |
| `packages/domain/src/strava.ts` | 30-day window, parse/normalize summary |
| `packages/domain/src/sports.ts` | `sport_type` → `run` / `ride` / … |
| `apps/api/migrations/20260923180000_strava_integrations.ts` | `integrations`, real `activities`, `activity_sources` |

---

## 4. Connect (step by step)

User must already have a Google session ([auth.md](./auth.md)). `/app` is cookie-gated.

### 4.1 Open `/app`

TanStack Query loads:

1. `GET /api/v1/integrations` — empty until connected.
2. `GET /api/v1/activities` — empty until import.
3. `GET /api/v1/me` — units for distance formatting.

No Strava row → **Connect Strava**.

### 4.2 Click Connect Strava

```ts
api.connectStrava()  // POST /api/v1/integrations/strava/connect
window.location.assign(url)
```

Fastify `requireUser` reads the session cookie. Then `createConnectUrl`:

1. HMAC-signed `state` = `{ userId, expires }` (15 minutes), signed with `BETTER_AUTH_SECRET`.
2. Redirect URL:

```
https://www.strava.com/oauth/authorize
  ?client_id=…
  &redirect_uri=http://127.0.0.1:5173/api/v1/integrations/strava/callback
  &response_type=code
  &approval_prompt=auto
  &scope=read,activity:read_all
  &state=…
```

`activity:read_all` includes private activities. The SPA navigates the browser to that URL (full page, not `fetch`).

### 4.3 Strava consent

User authorizes (or cancels). Strava redirects the **browser** to the Vite origin:

```
GET http://127.0.0.1:5173/api/v1/integrations/strava/callback
  ?code=…
  &state=…
```

or `?error=access_denied`.

Vite strips `/api` and Fastify handles `GET /v1/integrations/strava/callback`.

### 4.4 Callback on Fastify

1. Load session from cookie. Missing/mismatch vs `state.userId` → redirect `/app?strava=error`.
2. `error=access_denied` → `/app?strava=denied`.
3. `POST https://www.strava.com/oauth/token` with `code` + client secret (`grant_type=authorization_code`).
4. Upsert `integrations` for `(user_id, provider=strava)`: athlete id, encrypted access + refresh tokens, `expires_at`, `status=active`.
5. Import last 30 days in the same request (see §5).
6. Redirect `/app?strava=connected`.

The `/app` page reads `strava` from the URL (`connected` / `denied` / `error`) and shows English copy from `packages/i18n`.

Reconnect (Connect again after already linked) overwrites tokens on the same unique `(user_id, strava)` row.

---

## 5. Import (last 30 days)

`stravaInitialBackfillDays = 30` in `packages/domain`. `after` is Unix seconds: now minus 30 × 24h.

```
GET https://www.strava.com/api/v3/athlete/activities
  ?after=<unix>
  &page=1
  &per_page=100
```

Paginate until a page is empty or shorter than 100. Access token is decrypted from `integrations`. If `expires_at` is within 60 seconds, Fastify refreshes first (`grant_type=refresh_token`) and writes new encrypted tokens. Strava’s refresh JSON does **not** include `athlete`; only the authorization-code exchange does.

Each summary JSON is:

1. `parseStravaSummary` — must have numeric `id`.
2. `normalizeStravaSummary` — must have a valid `start_date`. Maps sport, title, times, distance, HR, `map.summary_polyline`.
3. Upsert `activity_sources` unique `(provider, external_id)` and the parent `activities` row.

One Strava activity = one canonical activity. No merge with other providers yet. Re-import updates stats; if `title_overridden` is true later, title stays (the column exists; the UI does not set it yet).

Default visibility is `private`. List hides `deleted_at` rows.

Failures: token **401** marks the integration `expired`; other errors mark `error` and store `last_error`. Callback still redirects to `/app?strava=error` if the whole exchange/import throws.

**Resync** is the same import: `POST /v1/integrations/:id/resync` (session required, integration must belong to the user). The SPA invalidates `['activities']` and `['integrations']`.

---

## 6. What is stored

**`integrations`**

- `external_user_id` — Strava athlete id (string).
- `access_token_enc` / `refresh_token_enc` — `v1.<iv>.<tag>.<ciphertext>` AES-256-GCM. Never logged.
- `status` — `active` \| `expired` \| `error` \| `revoked`.
- `last_sync_at`, `last_error`.

Public JSON never includes tokens:

```json
{
  "id": "…",
  "provider": "strava",
  "status": "active",
  "externalUserId": "42",
  "lastSyncAt": "2026-09-23T12:00:00.000Z"
}
```

**`activity_sources`**

Raw summary payload (`jsonb`), fingerprint `startedAt|sport|roundedMeters`, polyline presence (`has_gps`).

**`activities`**

Canonical fields used by the list: sport, title, `started_at`, distance, moving time, polyline, `field_sources` pointing at the Strava source id.

---

## 7. List UI

`GET /v1/activities` returns newest `started_at` first. Distances/times use `@road-to/domain` formatters and the user’s `units` from `/v1/me` (metric vs imperial). Source badge is implied as Strava-only for now (`sources: [{ provider: "strava" }]`).

Detail page, maps, title override, and per-activity resync are not built yet. The summary polyline is stored so a map can use it later.

---

## 8. Request map (dev)

| Browser | Fastify | Strava |
| --- | --- | --- |
| `POST /api/v1/integrations/strava/connect` | `POST /v1/integrations/strava/connect` | — (returns authorize URL) |
| (browser follows URL) | — | `GET /oauth/authorize` |
| `GET /api/v1/integrations/strava/callback` | `GET /v1/integrations/strava/callback` | `POST /oauth/token` then `GET /api/v3/athlete/activities` |
| `GET /api/v1/integrations` | `GET /v1/integrations` | — |
| `GET /api/v1/activities` | `GET /v1/activities` | — |
| `POST /api/v1/integrations/:id/resync` | `POST /v1/integrations/:id/resync` | `GET /api/v3/athlete/activities` (last 30 days again) |

OpenAPI: `/docs` (also `http://127.0.0.1:5173/docs`).

---

## 9. Not in this slice

- 24-month / full-history backfill.
- Strava webhooks (needs a public URL).
- Activity detail, MapLibre, title override UI.
- Disconnect / revoke.
- Dedupe / field merge with other providers.
- Whoop, Garmin, TrainingPeaks adapters.

---

## 10. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Connect button → “Strava is not configured” | Empty `STRAVA_CLIENT_ID` / `SECRET`, or API not restarted after `.env` |
| Strava form “must be just a domain” | Put `127.0.0.1` in Authorization Callback Domain, not the full path |
| Callback lands and `/app?strava=error` | Session missing (callback not on `:5173`), bad `state`, or token/import failed |
| User cancels on Strava | `/app?strava=denied` |
| List stays empty after connected | No activities in the last 30 days, or import error (`last_error` on the integration) |
| Tokens look like `v1.…` in the DB | Expected. Decrypt only happens in the API process |
