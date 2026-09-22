# Road To — Implementation Plan

**Status:** draft, pre-implementation  
**Date:** 2026-09-21  
**Depends on:** [requirements.md](./requirements.md)

This plan turns the requirements into a buildable architecture. Nothing in this document requires code to be written yet; it is the sequence and the technical defaults to use when implementation starts.

---

## 1. Recommended architecture

Two deployable apps from day one, plus shared TypeScript packages. The web UI never talks to Garmin/Strava/Whoop/TrainingPeaks directly.

```
                    ┌──────────────┐     ┌──────────────┐
                    │  Web (React) │     │ Mobile later │
                    │  TanStack    │     │ React Native │
                    └──────┬───────┘     └──────┬───────┘
                           │  HTTPS JSON        │
                           ▼                    ▼
                    ┌───────────────────────────────────┐
                    │         Fastify API               │
                    │  auth, CRUD, share, sync trigger  │
                    └──────────────┬────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       ┌────────────┐      ┌─────────────┐      ┌─────────────┐
       │ PostgreSQL │      │  Job queue  │      │ Object store│
       │ + PostGIS  │      │  (pg-boss)  │      │ FIT / files │
       │  later     │      │  in Postgres│      │ (later S3)  │
       └────────────┘      └──────┬──────┘      └─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                 Strava        Whoop      Garmin / TP
                 webhooks     webhooks    (when approved)
```

**Why not put the API inside the React app?** A native app will need the same backend. Provider webhooks must hit a stable public HTTP API. Sync is long-running and does not belong in a browser.

**Why Fastify?** Matches the Node.js requirement, low overhead, first-class TypeScript, good plugin story for auth, sensible for webhook endpoints that must reply in milliseconds (Strava requires 200 within 2 seconds).

---

## 2. Stack choices

### 2.1 Frontend (web)

| Choice | Use for |
| --- | --- |
| React + TypeScript | UI |
| Vite | Dev server and bundling |
| TanStack Router | Typed routes, including `/share/:token` |
| TanStack Query | Server state, sync status polling, infinite activity lists |
| TanStack Table + Virtual | Activity lists at thousands of rows |
| TanStack Form + Zod | Project rules, settings, notes |
| MapLibre GL JS | Activity maps (no Mapbox token required) |
| Tailwind CSS (v4, Vite plugin) | Styling, layout, and later design-token theming |
| i18next + react-i18next | UI copy. English catalog only in v1; no hardcoded user-facing strings |

TanStack Start (SSR) is a later option for share-page SEO and Open Graph tags. v1 is a SPA: Fastify can serve a small HTML shell with OG tags for `/share/:token` if previews matter early.

**Why Tailwind.** Utility classes keep the first screens moving without a component library lock-in, and a small `theme` (colors, type scale, spacing, radii) is enough to restyle the product later. Use `@theme` tokens from day one so “customizable later” means changing tokens, not hunting one-off hex values. Reach for a headless kit (e.g. Base UI or Ark) only when we need accessible dialogs/menus; do not adopt a heavy styled kit (MUI, Ant) on top of Tailwind.

Tailwind is web CSS. React Native will not consume `className` strings unless we add NativeWind later. The portable part is the **token set** (color, space, type), not the utility markup. That matches the rest of the UI-sharing stance: domain and API client are shared; screens are platform-specific.

### 2.2 Shared packages vs React Native

Do **not** start with React Native Web or Tamagui. Those constrain maps, selection, and share pages on the web for a mobile app that does not exist yet.

Share what actually ports:

| Package | Shared with RN? | Contents |
| --- | --- | --- |
| `packages/domain` | yes | Types, sport enums, dedupe fingerprint, field merge, auto-assign rules, aggregation pure functions, Zod schemas |
| `packages/api-client` | yes | Typed `fetch` client for the Fastify API |
| `packages/i18n` | yes | Locale catalogs (`en` first). Web and later RN load the same keys. |
| `packages/ui` | not at first | Web components. Later, extract stat chips / list rows into RN-friendly primitives if duplication hurts |

When mobile starts, add `apps/mobile` (Expo). Reuse `domain` + `api-client`. Reimplement screens with React Native. Maps become MapLibre RN or similar. Auth uses native Google / Apple SDKs against the same Fastify session or token endpoint.

If a design system is introduced, put Tailwind `@theme` tokens (and later a NativeWind theme) in a small shared package so color and spacing stay aligned. Do not try to share `className`-heavy React components with RN.

### 2.3 Backend

| Choice | Use for |
| --- | --- |
| Node.js + Fastify + TypeScript | HTTP API |
| Kysely + `pg` | Typed SQL against PostgreSQL |
| kysely-ctl | Migrations (schema lives in migration files + a `Database` type) |
| Zod | Request validation; share schemas with the client |
| Better Auth | Google and Apple; session cookies on web. Native adapter is Kysely. |
| pg-boss | Sync, webhook follow-up, backfill (queue in Postgres, no Redis yet) |
| `libsodium` or AWS KMS-style envelope | Encrypt provider tokens at rest |

**Why Kysely, not Drizzle or Prisma.** This API is query-heavy: JSONB payloads, `date_trunc` aggregations, joins for merge/provenance, later maybe PostGIS. Kysely is a typed query builder, not an ORM — you write SQL-shaped code and TypeScript checks the columns. That matches how we already described the data model.

Drizzle is the close alternative (also SQL-like, bundled migrations). We are not using it because Better Auth’s default database layer is Kysely, so one query toolkit covers auth tables and app tables. Prisma is a worse fit for JSONB and ad-hoc SQL.

Migrations via **kysely-ctl**: each migration is up/down SQL (or Kysely schema builder). The TypeScript `Database` interface is the source of types; keep it in lockstep with migrations (review in PR; no codegen required for v1). Use `sql` fragments when a Postgres feature has no helper yet.

### 2.4 Database: PostgreSQL

PostgreSQL is the right default.

| Need | Why Postgres fits |
| --- | --- |
| Users, activities, projects, many-to-many assignments | Relational integrity |
| Provider-specific payloads | `jsonb` on `activity_sources.payload` |
| Dedupe + resync | Transactions; unique `(provider, external_id)` |
| Aggregations | `date_trunc`, filters, later materialized views |
| Maps later | PostGIS if we store tracks, not only encoded polylines |
| Queue + cache delay | pg-boss now; Redis only when we outgrow it |

Skip a document store. Skip SQLite as the primary store (weak concurrent writes for webhooks + user traffic).

**When to add other services (not v1):**

| Service | Add when |
| --- | --- |
| Redis | Hot dashboard aggregations or session fan-out needs sub-ms cache |
| BullMQ / Redis | Job volume or latency that pg-boss cannot absorb |
| S3 / R2 | FIT files, original GPX, map snapshots, OG images |
| CDN | Share pages and map static assets |
| Observability (OpenTelemetry + Axiom/Grafana) | Second integration goes live or sync failures become hard to see |

### 2.5 Monorepo layout

```
road-to/
  apps/
    web/                 Vite + React + TanStack + Tailwind
    api/                 Fastify
  packages/
    domain/
    api-client/
    i18n/                en.json first; more locales later
    tsconfig/
  docs/
  docker-compose.yml     Local datastores (Postgres, later Redis)
  docker-compose.prod.yml  Optional full-stack deploy reference
  apps/api/Dockerfile
  apps/web/Dockerfile    nginx (or similar) serving the Vite build
  pnpm-workspace.yaml
```

pnpm workspaces. One CI pipeline: typecheck, unit tests (domain), API integration tests against Postgres, image build.

### 2.6 Docker: local vs deployment

Use Docker for **datastores locally** and for **shipping the apps**. Do not make Docker the daily inner loop for Vite and Fastify.

| What | Local | Production |
| --- | --- | --- |
| PostgreSQL (later Redis, MinIO) | **Yes** — Compose | **Yes** — managed Postgres if the host offers it, otherwise a container |
| Fastify API + worker | **No (default)** — `pnpm --filter api dev` on the host | **Yes** — one image, different `CMD` for `api` vs `worker` |
| Web (Vite) | **No (default)** — `pnpm --filter web dev` on the host | **Yes** — multi-stage build, static files behind nginx or the API |
| Full stack in Compose | Optional `--profile full` for onboarding or a prod-like smoke | Optional first private VPS; not the long-term orchestration story |

**Local: why not containerize Node by default.** Vite HMR and Fastify restarts are slower and flakier in Docker on macOS (bind mounts, file watching). Breakpoints, `pnpm`, and the TypeScript language service all work better on the host. Pin the Node version with `engines` plus Volta, mise, or `.nvmrc` so “works on my machine” is still true.

**Local: why still Docker.** Postgres version, extensions (later PostGIS), ports, and a throwaway volume should not depend on each laptop’s Homebrew install. `docker compose up -d postgres` is the entire datastore story for Phase 0.

**Deployment: why Docker.** Images are the portable unit for Fly, Cloud Run, ECS, a VPS, or Kubernetes later. Multi-stage Dockerfiles keep runtime images small. CI builds and tags `api` and `web`; a worker is the API image with `node dist/worker.js`. Start with a single region and a managed Postgres. Do not start on Kubernetes.

**Do not:** rebuild images on every local save; use Compose as the only documented way to run the app; run Postgres in the same container as the API.

---

## 3. Data model

### 3.1 Core tables

```
users
  id, display_name, email, avatar_url, units ('metric'|'imperial'), created_at

auth_accounts          -- managed mostly by Better Auth
sessions

integrations
  id, user_id
  provider               -- strava | garmin | whoop | trainingpeaks
  external_user_id
  access_token_enc, refresh_token_enc, expires_at, scopes[]
  status                 -- active | expired | error | revoked
  last_sync_at, last_error
  unique (user_id, provider)

activities               -- canonical (merged view)
  id, user_id
  sport                    -- normalized enum (run, ride, swim, strength, ...)
  title                    -- provider default after merge, unless overridden
  title_overridden         -- boolean; resync must not clobber title when true
  started_at, ended_at, timezone
  distance_m, moving_time_s, elapsed_time_s
  elevation_gain_m, avg_hr, max_hr, avg_speed_mps, calories
  map_polyline             -- encoded polyline, nullable
  bbox                     -- optional, for list map thumbs later
  visibility               -- private | public
  description              -- owner note
  field_sources jsonb      -- { distance_m: source_id, map_polyline: source_id, ... }
  preferred_source_id      -- conflict tie-break; does not wipe gap-filled fields
  deleted_at               -- soft hide
  created_at, updated_at

activity_sources
  id, activity_id, integration_id
  provider, external_id
  payload jsonb            -- raw API object (size-capped)
  fingerprint              -- for matching
  has_gps, started_at, distance_m, duration_s, sport_raw
  provider_updated_at, synced_at, deleted_on_provider_at
  unique (provider, external_id)

activity_streams
  activity_id, kind        -- latlng | hr | altitude | time | cadence | watts
  source_id                -- which activity_sources row this stream came from
  samples                  -- jsonb or bytea (compressed)
  unique (activity_id, kind)

health_samples
  id, user_id, integration_id
  provider, external_id
  kind                     -- sleep | recovery | hrv | rhr | strain | steps
  started_at, ended_at, day  -- day in user timezone for rollups
  value jsonb
  unique (provider, external_id)

projects
  id, user_id, name, slug, description, archived_at, created_at

project_rules
  id, project_id
  sport_filter             -- enum[] or 'all'
  window_start, window_end -- dates, inclusive
  enabled

project_activities
  project_id, activity_id
  origin                   -- rule | manual
  rule_id                  -- nullable
  excluded                 -- true = sticky manual removal
  unique (project_id, activity_id)

share_links
  id, user_id
  kind                     -- activity | project | activity_list
  resource_id              -- activity or project id; null for activity_list
  token                    -- 128-bit random, unique
  revoked_at, created_at

sync_jobs
  id, user_id, integration_id
  kind                     -- backfill | incremental | activity | webhook
  status, progress, error
  created_at, finished_at
```

Indexes (minimum): `activities (user_id, started_at desc)`, `activities (user_id, sport, started_at)`, `project_activities (project_id, activity_id)`, `health_samples (user_id, kind, day)`.

### 3.2 What is stored vs refetched

| Store | Do not store |
| --- | --- |
| Normalized stats used in lists/aggregations | Provider access tokens in plaintext |
| Encoded polyline for the map | Full-resolution streams until a detail page needs them (can lazy-fetch once, then cache) |
| Raw payload (trimmed) so resync/reprocess works without another API call | Every FIT file in v1 (add object storage when Garmin lands) |
| User notes, visibility, title overrides, assignments | Viewer analytics beyond basic logs |

---

## 4. Sync and dedupe

### 4.1 Provider adapter

Each provider implements the same port:

```ts
interface ActivityProvider {
  id: 'strava' | 'garmin' | 'whoop' | 'trainingpeaks'
  startOAuth(userId: string): Promise<URL>
  handleOAuthCallback(input: OAuthCallback): Promise<Integration>
  listActivities(cursor: SyncCursor): Promise<Page<RawActivity>>
  getActivity(externalId: string): Promise<RawActivity>
  getStreams?(externalId: string): Promise<RawStreams>
  parseWebhook?(headers, body): WebhookEvent | null
  revoke?(integration: Integration): Promise<void>
}
```

Health is a second port (`HealthProvider`) that Whoop and Garmin implement. Strava does not.

This is how Garmin/TrainingPeaks stay “designed but dark” until API keys exist.

### 4.2 Job flow

1. User connects provider → `backfill` job.
2. Webhook POST → Fastify returns 200 immediately → enqueue `webhook` job with the object id.
3. User clicks resync → enqueue `activity` or `incremental` job.
4. Worker: refresh token if needed → pull → normalize → fingerprint → match or create canonical → write sources → **merge fields into the canonical row** → apply project rules → update `last_sync_at`.

Workers are Fastify-adjacent processes using pg-boss. Same codebase, second entrypoint (`apps/api` can run `api` or `worker`). Horizontal scale later: N API instances + M workers.

### 4.3 Dedup and field merge (v1)

**Match.** For a newly imported source record, search the same user’s activities where:

- `started_at` within ±10 minutes (widen to 20 if both lack GPS),
- sport family matches (run includes trail/treadmill; do not match run vs ride),
- distance within 8% if both distances > 500 m,
- duration within 8% if both durations > 5 minutes,
- if both have polylines: Frechet-lite or overlap of start/end points within 150 m.

If exactly one candidate: auto-merge.  
If none: create canonical activity.  
If several: create canonical, flag `needs_review` (UI later; until then keep separate).

Never merge across users. Never drop source rows. Never merge a sleep health sample into an activity.

**Fill gaps, then resolve conflicts.** After sources are attached, rebuild the canonical row from the union of normalized source fields:

1. User-owned fields stay untouched: `visibility`, `description`, `title` when `title_overridden`, project membership, `preferred_source_id`.
2. If exactly one source has a non-null value for a field, copy it and set `field_sources[field]` to that source.
3. If several sources have a value and they agree within a small tolerance (distance 1%, duration 2%, same title string), keep one and still record provenance as the highest-ranked of those sources.
4. If they disagree, pick using the per-field ranking below, unless the user set `preferred_source_id` — that source wins **this conflict** when it actually has a value. Gap-filled fields from other providers remain.
5. Streams merge by kind, not by mixing samples: one GPS polyline (highest-quality), one HR series if the GPS source has none, and so on. Do not stitch two polylines together in v1.

Default ranking when sources conflict (highest first):

| Field group | Rank |
| --- | --- |
| Map, distance, elevation, speed | Garmin, TrainingPeaks, Strava, Whoop |
| Heart rate / HR stream | Garmin, TrainingPeaks, Whoop, Strava |
| Title | Strava, Garmin, TrainingPeaks, Whoop |
| Moving / elapsed time | Garmin, TrainingPeaks, Strava, Whoop |
| Calories, strain-like extras | the only source that has them, else Whoop, Garmin, TrainingPeaks, Strava |

Example: a Garmin/Strava outdoor run plus a Whoop workout for the same hour → one canonical activity with Garmin (or Strava) polyline and distance, Whoop HR if Garmin has none, Strava title unless the user renamed it. Source badges show all three.

Rebuild this merge on every resync and on split/re-merge. The function lives in `packages/domain` and is unit-tested with fixtures.

### 4.4 Resync

Resync updates `activity_sources.payload` and re-runs field merge onto the canonical row. It must not wipe `visibility`, `description`, `title` when `title_overridden`, `preferred_source_id`, or project membership.

If `title_overridden` is false, a provider title change (or a better merged title) may update `title`.

### 4.5 Provider-specific notes

**Strava**

- OAuth scopes: `activity:read_all` (private activities), `profile:read_all` only if needed.
- Register a webhook subscription; acknowledge in < 2s; fetch the activity in a job.
- Rate limits are tight (on the order of 200 req / 15 min and 2,000 / day per app at default). Backfill must throttle, persist cursors, and prefer webhooks after the first import.
- Streams: `latlng,time,altitude,heartrate` on detail/resync, not on list import.
- Default import: last 24 months via `GET /athlete/activities` pagination, then hydrate details in batches.

**Whoop**

- Scopes: `read:workout read:sleep read:recovery read:cycles offline`.
- Workouts → `activity_sources` (often no map). Eligible for merge with Garmin/Strava sessions.
- Sleep + recovery → `health_samples` only. **Sleep is never an activity** and never appears on activity lists.
- Webhooks: `workout.*`, `sleep.*`, `recovery.*`.
- Production member cap: plan a waitlist if this becomes a public product. Personal use is fine within Whoop’s test-app limits.

**Garmin** (when unblocked)

- Partner program, OAuth2 PKCE.
- Ping/pull or push; Activity API + Health API; FIT via Activity API.
- Token lifetime is long but not infinite; persist refresh.
- Until the program reopens, keep the adapter as a stub and hide the connect button behind an env flag.

**TrainingPeaks** (when unblocked)

- Partner OAuth; scopes are not nested (`workouts:details` does not include `workouts:read`).
- Completed workouts for the activity library; wellness metrics for health.
- Planned future workouts are out of v1 scope.
- Same env-flag pattern as Garmin.

Do not scrape unofficial Garmin/TP endpoints. That violates terms and will break.

**Contingency:** if Garmin stays closed and the product needs watch data, evaluate a vendor such as Terra as an optional adapter behind the same `ActivityProvider` port. Do not build the product around the vendor.

---

## 5. API sketch (Fastify)

Versioned prefix `/v1`. Session cookie for the owner SPA. Share routes are cookie-optional.

```
POST   /v1/auth/*                    Better Auth handler

GET    /v1/me
PATCH  /v1/me
DELETE /v1/me

GET    /v1/integrations
POST   /v1/integrations/:provider/connect      → redirect URL
POST   /v1/integrations/:provider/callback
DELETE /v1/integrations/:id
POST   /v1/integrations/:id/resync

GET    /v1/activities?from&to&sport&projectId&visibility&cursor
GET    /v1/activities/:id
PATCH  /v1/activities/:id                      visibility, description, title (sets title_overridden), preferredSourceId
POST   /v1/activities/:id/resync
POST   /v1/activities/:id/merge
POST   /v1/activities/:id/unmerge

GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/:id
PATCH  /v1/projects/:id
DELETE /v1/projects/:id
PUT    /v1/projects/:id/rules
POST   /v1/projects/:id/activities             manual add
DELETE /v1/projects/:id/activities/:activityId sticky remove

GET    /v1/aggregations?scope=user|project&projectId&from&to&grain=day|week|month

POST   /v1/shares                              { kind, resourceId }
GET    /v1/shares
DELETE /v1/shares/:id

GET    /v1/public/shares/:token                share payload for the SPA

POST   /v1/webhooks/strava
POST   /v1/webhooks/whoop
POST   /v1/webhooks/garmin
POST   /v1/webhooks/trainingpeaks
```

Authorization helpers live in one module: `assertOwner`, `resolveShare`. Share payloads are DTOs that include owner display name and avatar, source badges, and omit tokens, emails, and private activities.

---

## 6. Auth

Better Auth on Fastify:

- Google: OAuth client in Google Cloud, authorized redirect to the API.
- Apple: Apple Developer Program, Service ID, JWT client secret from the `.p8` key, return URL on the API. Apple requires HTTPS and a privacy policy URL even in development-adjacent setups.
- Session: HTTP-only secure cookie, `SameSite=Lax`, API and web on sibling domains (`api.road-to.example` + `app.road-to.example`) or a reverse proxy on one origin in v1 to avoid CORS pain.

v1 recommendation: **single origin** behind a reverse proxy (`/api` → Fastify, `/` → Vite build). Simplest cookies. Split domains when the mobile app needs token-based auth (Better Auth supports issuing bearer tokens for native).

---

## 7. Frontend structure (web)

```
apps/web/src/
  routes/              TanStack Router file routes
  features/
    auth/
    activities/        list, detail, map, note editor, source badges, title override
    projects/
    share/             read-only views reused from features but without owner chrome
    aggregations/
    integrations/
  shared/              layout, units formatting, query keys
  locales/             wired via packages/i18n; do not hardcode copy
```

Query keys follow resources (`['activities', filters]`, `['activity', id]`). After resync or patch, invalidate the activity and aggregations.

Maps: decode polyline → MapLibre `LineLayer`. No map on indoor/Whoop-only sessions.

Share pages reuse presentational components (`ActivityStats`, `ActivityMap`, `ActivityList`) with a `variant="public"` so owner-only controls stay out. They always render the owner’s name and photo, and source badges that follow each provider’s brand guidelines (wordmark/logo only as those terms allow).

---

## 8. Implementation phases

Build in vertical slices that are demoable. Do not connect four providers before a user can list one activity.

### Phase 0 — Skeleton (foundation)

- Monorepo, Docker Compose Postgres, Kysely + kysely-ctl migrations for `users` + empty `activities`.
- Fastify health check, Better Auth Google (Apple can follow in the same phase).
- Web: login, empty app shell, TanStack Router + Query, Tailwind with a small `@theme` token set, i18next with `en` catalog.
- CI: typecheck + lint.

**Exit:** sign in, sign out, session cookie works.

### Phase 1 — Strava library

- `integrations` + OAuth.
- Backfill job + activity list + detail + MapLibre.
- Store source payload and polyline.
- Provider title as default; owner can override.
- Source badge (Strava branding).
- Manual resync per activity and per integration.
- Units formatting.

**Exit:** a real Strava account shows outdoor runs on a map.

### Phase 2 — Privacy, notes, Apple

- Activity visibility and description.
- Sign in with Apple.
- Account delete.

**Exit:** private by default; notes survive resync.

### Phase 3 — Projects

- CRUD projects, manual assign, date-window + sport rules, sticky exclude.
- Project-scoped list.
- Re-run rules after import.

**Exit:** “Road to Marathon” auto-picks 2026-01-01..2026-04-30 runs.

### Phase 4 — Sharing

- `share_links`, public DTO, `/share/:token` route.
- Revoke.
- Optional Fastify OG HTML for link unfurls.

**Exit:** logged-out browser sees owner name and photo and only public project activities.

### Phase 5 — Whoop + aggregations

- Whoop adapter: workouts into activities (dedupe + **field merge** against Strava), sleep/recovery into `health_samples` only.
- Dedupe v1 + gap-fill + conflict ranking + preferred source as tie-break.
- Aggregation endpoint + dashboard widgets (monthly run km, monthly sleep hours). Formulas stay replaceable.

**Exit:** one session that exists on Strava and Whoop appears once, with complementary stats merged; monthly totals look right; sleeps are not in the activity list.

### Phase 6 — Garmin / TrainingPeaks

- Enable adapters behind env flags when partner access exists.
- FIT storage decision (object store).
- Health from Garmin if Whoop is absent.

**Exit:** connect button works for an approved developer account; still hidden otherwise.

### Phase 7 — Hardening toward scale

- Throttle / retry / dead-letter for jobs.
- Materialized daily rollups if aggregations get slow.
- PostGIS only if we need spatial queries.
- Redis/BullMQ only with evidence.
- Observability.

### Phase 8 — Mobile (later)

- Expo app, `api-client` + `domain`.
- Native Google/Apple sign-in.
- Native maps. No requirement to reuse web components 1:1.

---

## 9. Testing strategy

**Runner:** Vitest for unit and component tests (`pnpm test`). Playwright later for logged-out share flows.

| Layer | What |
| --- | --- |
| `packages/domain` | Dedupe fixtures, field-merge/gap-fill, auto-assign + sticky exclude, share visibility filtering, aggregation math |
| `packages/api-client` | Request errors, URL handling, mocked `fetch` |
| API | Fastify `inject` for HTTP handlers; Testcontainers/Postgres when Kysely lands |
| Web | Component tests (Testing Library + jsdom); Playwright for login + share as anonymous |
| Providers | Contract tests with recorded fixtures (never live tokens in CI) |

Golden fixtures: two Strava/Garmin copies of the same run; a treadmill run vs an outdoor run at a similar time (must not merge); a run the user removed from a project that must not reappear after sync.

---

## 10. Security and compliance checklist

- Encrypt tokens at rest; restrict DB access.
- Never log access tokens or share tokens in full.
- CSRF: cookie sessions + SameSite; Better Auth CSRF if used.
- Webhook signature / verify-token checks per provider.
- Rate-limit connect and share-create endpoints.
- Respect each provider’s attribution, branding, and data-use terms even while the app is personal. Show source marks in the UI; do not redistribute activity data as a social network clone (Strava in particular).
- Privacy policy URL (Apple and Google require it).
- GDPR-ish delete: user, integrations, activities, sources, health, shares.

This is not legal advice; a public launch needs a real terms/privacy review.

---

## 11. Local development

Default inner loop (Docker only for Postgres):

```
docker compose up -d postgres
pnpm --filter api migrate
pnpm --filter api dev          # Fastify + worker on the host
pnpm --filter web dev          # Vite + Tailwind HMR on the host
```

Optional: `docker compose --profile full up` runs API + web in containers when someone wants a prod-like stack without installing Node. That profile is for smoke tests, not day-to-day editing.

Strava/Whoop OAuth needs public callback URLs: use a tunnel (ngrok/Cloudflare Tunnel) for webhooks, or a mock provider in dev.

`.env.example` lists Google, Apple, Strava, Whoop, Garmin, TrainingPeaks client ids — all optional except Google or Apple for login.

---

## 12. Decisions log

| Decision | Choice | Revisit when |
| --- | --- | --- |
| API vs BFF-in-React | Separate Fastify API | Never for this product |
| Database | PostgreSQL | Unlikely |
| SQL layer | Kysely + kysely-ctl (not Drizzle/Prisma) | Never, unless Better Auth adapter story changes |
| Queue | pg-boss in Postgres | Job latency/volume hurts |
| Cache | None in v1 | Dashboard queries > ~200ms p95 |
| Web maps | MapLibre | Need satellite style with a paid provider |
| Cross-platform UI | Shared domain + API client, not shared React tree | Mobile work starts |
| First live provider | Strava | Always; others are additive |
| Dedupe | Conservative match, then field-level merge (fill gaps; rank conflicts) | Users report bad merges or wrong stats |
| Activity title | Provider default + user override (`title_overridden`) | — |
| Sleep | Health metric only, never an activity | — |
| Share pages | Owner name + photo | Owner wants anonymous shares |
| i18n | i18next, `packages/i18n`, English only in v1 | Adding a second locale |
| Product posture | Personal first; still brand and attribute sources | Public launch / App Store |
| Auth | Better Auth, Google then Apple | If native token story is awkward |
| Web styling | Tailwind CSS v4 + `@theme` tokens | Mobile starts and NativeWind is worth it |
| Local Node | Host `pnpm`, Docker for Postgres only | Team onboarding is painful without a full Compose profile |
| Deploy | Multi-stage Docker images for api/web/worker | Host offers a better native Node buildpack *and* we drop containers everywhere |

---

## 13. Suggested first implementation ticket

When you are ready to write code, start with Phase 0 only:

1. pnpm workspace + `apps/api` + `apps/web` + `packages/domain` + `packages/i18n`.
2. Dockerized Postgres + Kysely migrations + `users`.
3. Better Auth Google + a protected `/app` route.

Stop there and plug in Strava next. Do not scaffold all four adapters up front beyond empty `ActivityProvider` interfaces.
