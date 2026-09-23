# Auth workflow

**Status:** Phase 0 (Google session cookies)  
**Date:** 2026-09-23

Google OAuth via [Better Auth](https://www.better-auth.com/). The browser never talks to Google or Postgres directly. Vite (`:5173`) is the public origin; Fastify (`:3001`) runs auth behind `/api`.

Password login is off. Apple is not wired yet.

---

## 1. What talks to what

```
Browser (localhost:5173)
  │  POST /api/auth/sign-in/social
  │  GET  /api/auth/callback/google
  │  GET  /api/v1/me          (credentials: include)
  │  POST /api/auth/sign-out
  ▼
Vite proxy
  /api/auth/*  →  Fastify :3001  (path unchanged)
  /docs        →  Fastify :3001  (Swagger UI)
  /api/*       →  Fastify :3001  (strip /api)   e.g. /api/v1/me → /v1/me
  ▼
Fastify
  /api/auth/*  →  auth.handler (Better Auth)
  GET /v1/me   →  auth.api.getSession
  ▼
PostgreSQL
  user, session, account, verification
```

Same-origin cookies matter. Google redirects to `:5173`, not `:3001`, so the OAuth state cookie and the later session cookie are first-party.

---

## 2. Files

| File | Role |
| --- | --- |
| `apps/web/src/auth/client.ts` | `createAuthClient()` — sign-in / sign-out HTTP helper |
| `apps/web/src/auth/session.ts` | `createApiClient({ baseUrl: '/api' })` + `meQueryOptions` |
| `apps/web/src/routes/login.tsx` | Google button; skip login if already signed in |
| `apps/web/src/routes/app.tsx` | Gate: no session → `/login` |
| `apps/web/src/routes/__root.tsx` | Header Sign in / Sign out |
| `apps/web/vite.config.ts` | `/api`, `/api/auth`, and `/docs` proxy |
| `apps/api/src/index.ts` | Pool + `createAuth` + `buildApp` |
| `apps/api/src/auth.ts` | `betterAuth({ google, Kysely/pg })` |
| `apps/api/src/auth-routes.ts` | Catch-all `GET/POST /api/auth/*` |
| `apps/api/src/swagger.ts` | OpenAPI 3.1 + Swagger UI at `/docs` |
| `apps/api/src/app.ts` | `GET /v1/me` |
| `apps/api/src/env.ts` | `BETTER_AUTH_*`, Google, trusted origins |
| `apps/api/migrations/20260923000000_auth_and_activities.ts` | Auth tables + empty `activities` |

`VITE_API_URL` in `.env` is unused. The SPA always uses `/api`.

---

## 3. Sign in (step by step)

### 3.1 Open `/login`

`beforeLoad` in `login.tsx` runs `meQueryOptions()`:

1. `GET /api/v1/me` with cookies.
2. Vite rewrites to Fastify `GET /v1/me`.
3. `getSession({ headers })` looks up `better-auth.session_token`.
4. No cookie → **401**. The query treats 401/errors as `null`. Login page renders.
5. Cookie valid → `{ user }` → redirect to `/app`.

### 3.2 Click “Sign in with Google”

```ts
authClient.signIn.social({ provider: 'google', callbackURL: '/app' })
```

The client `POST`s `/api/auth/sign-in/social` on `:5173`. Vite forwards that path unchanged to Fastify.

### 3.3 Fastify → Better Auth

`auth-routes.ts` turns the Fastify request into a Fetch `Request`, calls `auth.handler`, copies status, headers, and `Set-Cookie` back.

Better Auth (`createAuth`):

- `baseURL` = `BETTER_AUTH_URL` (default `http://127.0.0.1:5173`)
- `basePath` = `/api/auth`
- Google `clientId` / `clientSecret` from env
- `trustedOrigins` includes `WEB_ORIGIN` plus `127.0.0.1:5173` and `localhost:5173`

It stores OAuth **state** (cookie + `verification` row), builds Google’s authorize URL, and sends the browser there.

Redirect URI Google must allow:

```
{BETTER_AUTH_URL}/api/auth/callback/google
```

Local default: `http://127.0.0.1:5173/api/auth/callback/google`.

### 3.4 Google callback

Google redirects the **browser** to:

```
http://127.0.0.1:5173/api/auth/callback/google?code=…&state=…
```

Vite proxies to Fastify. Better Auth:

1. Checks `state`.
2. Exchanges `code` with Google.
3. Upserts `user` and `account`.
4. Inserts `session`.
5. Sets `Set-Cookie: better-auth.session_token=…` (`HttpOnly`, `SameSite=Lax`, `Path=/`).
6. Redirects to `callbackURL` → `/app`.

### 3.5 Land on `/app`

`app.tsx` `beforeLoad` calls `/v1/me` again. Cookie present → 200 `{ user }` → page loads. Missing/invalid session → `/login`.

Header uses the same query: user → Sign out, else Sign in.

---

## 4. Sign out

Header:

```ts
await authClient.signOut();
queryClient.setQueryData(meQueryKey, null);
await router.navigate({ to: '/' });
```

`POST /api/auth/sign-out` deletes the `session` row and clears the cookie. React Query is cleared so the header does not wait for a refetch.

---

## 5. Session read (`GET /v1/me`)

Response when signed in:

```json
{
  "user": {
    "id": "…",
    "name": "…",
    "email": "…",
    "image": null,
    "units": "metric"
  }
}
```

| Status | Meaning |
| --- | --- |
| 200 | Cookie matches a session |
| 401 | No / invalid session |
| 503 | DB/session store failed (connection, schema) |

The web query treats **any** `/v1/me` failure as signed out so the shell does not crash if the API is down. `/app` still redirects to `/login` when `me` is null.

`units` is a Better Auth extra field on `user` (default `metric`). Email/password is disabled.

---

## 6. Database

Kysely migration `20260923000000_auth_and_activities` creates Better Auth’s tables (camelCase columns) plus empty `activities`:

| Table | Purpose |
| --- | --- |
| `user` | id, name, email, emailVerified, image, units, timestamps |
| `session` | token (unique), userId, expiresAt |
| `account` | Google (providerId, accountId) linked to user |
| `verification` | OAuth state / one-time values |
| `activities` | Empty placeholder for Phase 1 |

`corepack pnpm migrate` applies this (`kysely migrate:latest` in `apps/api`).

---

## 7. Local setup

```sh
cp .env.example .env          # set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
docker compose up -d postgres
corepack pnpm migrate
corepack pnpm dev
```

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres |
| `BETTER_AUTH_SECRET` | Cookie signing (≥ 32 chars) |
| `BETTER_AUTH_URL` | Public origin; Google redirect is `{this}/api/auth/callback/google` |
| `WEB_ORIGIN` | Extra trusted origin (CSRF) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web client |
| `VITE_API_URL` | Unused |

Google Cloud → Credentials → Web application. Authorized JavaScript origin: `http://127.0.0.1:5173`. Authorized redirect URI: `http://127.0.0.1:5173/api/auth/callback/google`. Restart the API after changing `.env` (`tsx` does not reload env on save).

If Postgres is not on `:5432`, `pnpm dev` prints a warning. `/v1/me` then returns 503 until Compose is up and migrations have run.

---

## 8. Request map (dev)

| Browser | Fastify |
| --- | --- |
| `POST /api/auth/sign-in/social` | `/api/auth/sign-in/social` |
| `GET /api/auth/callback/google` | `/api/auth/callback/google` |
| `POST /api/auth/sign-out` | `/api/auth/sign-out` |
| `GET /api/v1/me` | `GET /v1/me` |
| `GET /api/health` | `GET /health` |
| `GET /docs` | Swagger UI (`GET /docs/json` for the spec) |
