# RoadTo — repository structure

**Audience:** anyone opening this repo for the first time  
**Companion docs:** [requirements](./requirements.md) (product), [implementation plan](./implementation-plan.md) (how we will build the rest)

This file describes **what is on disk today**: workspaces, packages, directories, and how they connect. It is a pnpm **monorepo** — one git repository, several packages that depend on each other locally (not published to npm).

---

## 1. How workspaces work

[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) is the membership list:

```yaml
packages:
  - apps/*
  - packages/*
```

Every folder under `apps/` and `packages/` that has a `package.json` is a **workspace package**.

The import name is the `"name"` field in that package’s `package.json`, not the folder name. We use the `@road-to/` scope:

| Folder | Package name | Import as |
| --- | --- | --- |
| `apps/web` | `@road-to/web` | not imported (the SPA) |
| `apps/api` | `@road-to/api` | not imported (the server) |
| `packages/domain` | `@road-to/domain` | `from '@road-to/domain'` |
| `packages/api-client` | `@road-to/api-client` | `from '@road-to/api-client'` |
| `packages/i18n` | `@road-to/i18n` | `from '@road-to/i18n'` |
| `packages/tsconfig` | `@road-to/tsconfig` | `"extends": "../../packages/tsconfig/react.json"` (relative path in tsconfigs) |

A consumer declares the dependency with `workspace:*`. That tells pnpm to link the local folder instead of downloading from the registry:

```json
"@road-to/i18n": "workspace:*"
```

`exports` in a library `package.json` points at source TypeScript (`./src/index.ts`). Vite and tsx load that directly; there is no separate build step for libraries yet.

Root `package.json` (`road-to`) is **private**. It holds repo-wide scripts (lint, format, typecheck, test, dev) and shared dev tools (ESLint, Prettier, TypeScript, Vitest). It is not an app.

---

## 2. Dependency graph

```
                    @road-to/web
                   /      |      \
                  /       |       \
     @road-to/domain  @road-to/i18n  @road-to/api-client
                  \               /
                   @road-to/tsconfig   (dev, all TS packages)

                    @road-to/api  ──dev──►  @road-to/tsconfig
```

- **Web** is a client of the Fastify API over HTTP (`/api` proxy in Vite). It does not import `@road-to/api`.
- **API** does not yet depend on `domain` or `api-client`. It will use `domain` when business rules move server-side.
- **Later:** `apps/mobile` (Expo) would depend on `domain`, `api-client`, and `i18n` the same way web does.

---

## 3. Tree (current)

```
road-to/
├── package.json                 Root workspace: scripts + shared lint/test tools
├── pnpm-workspace.yaml          Which folders are packages; esbuild allowBuilds
├── pnpm-lock.yaml               Locked versions for the whole repo
├── tsconfig.json                Solution-style references only (no jsx here)
├── vitest.config.ts             Test projects: domain, api-client, i18n, api, web
├── eslint.config.js             One ESLint flat config for the repo
├── .prettierrc / .prettierignore
├── .editorconfig
├── .nvmrc                       Node 22
├── .env.example                 PORT, DATABASE_URL, VITE_API_URL
├── .gitignore
├── docker-compose.yml           Local Postgres 17 (not wired to the API yet)
├── LICENSE
├── README.md
├── .github/workflows/ci.yml     GitHub Actions: typecheck, lint, format, test
├── .vscode/settings.json        Workspace TypeScript SDK
├── scripts/dev.mjs              Starts API + web together (`pnpm dev`)
├── docs/
│   ├── requirements.md
│   ├── implementation-plan.md
│   └── repository.md            This file
├── apps/
│   ├── api/                     @road-to/api   — Fastify
│   └── web/                     @road-to/web   — Vite + React
└── packages/
    ├── domain/                  @road-to/domain
    ├── api-client/              @road-to/api-client
    ├── i18n/                    @road-to/i18n
    └── tsconfig/                @road-to/tsconfig
```

Not in the tree yet (planned): `apps/mobile`, Redis, Dockerfiles for deploy, provider adapters.

---

## 4. Root files (what they do)

| File | Role |
| --- | --- |
| `package.json` | `pnpm dev`, `pnpm migrate`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`. `packageManager`: pnpm 12.5.1. |
| `pnpm-workspace.yaml` | Workspace globs + `allowBuilds.esbuild` (pnpm 12 will not run install scripts unless allowed). |
| `tsconfig.json` | Project references to apps/packages so the editor can see the whole repo. Each package has its **own** tsconfig for `jsx` / Node. |
| `vitest.config.ts` | `test.projects` — one Vitest run at the root covers all five testable packages. |
| `eslint.config.js` | Ignores `dist`, `*.gen.ts`. React rules only under `apps/web`. |
| `scripts/dev.mjs` | Spawns `npm run dev` in `apps/api` and `apps/web` so `corepack pnpm dev` does not need `pnpm` on `PATH`. |
| `docker-compose.yml` | Service `postgres` on port 5432, user/db `roadto`. |
| `.github/workflows/ci.yml` | On **push to `main`** and on **pull requests**. |
| `.env.example` | Template; real `.env` is gitignored. |

**Root scripts**

```sh
corepack pnpm install
corepack pnpm migrate      # Kysely: Better Auth tables + empty activities
corepack pnpm dev          # API :3001 + web :5173
corepack pnpm dev:api
corepack pnpm dev:web
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format / format:check
corepack pnpm test / test:watch
```

---

## 5. `apps/web` — `@road-to/web`

The SPA. React 19, Vite 7, TanStack Router + Query, Tailwind v4, i18next.

```
apps/web/
├── package.json
├── tsconfig.json              extends packages/tsconfig/react.json; jsx: react-jsx
├── vite.config.ts             TanStack Router plugin, Tailwind plugin, /api → :3001
├── vitest.config.ts           jsdom + setupFiles
├── index.html                 data-theme="default"
└── src/
    ├── main.tsx               Router, QueryClient, i18n, applyTheme('default')
    ├── i18n.ts                initReactI18next + @road-to/i18n catalogs
    ├── styles.css             @import tailwind + theme; @theme maps CSS vars to utilities
    ├── vite-env.d.ts
    ├── routeTree.gen.ts       Generated; do not edit. Ignored by ESLint/Prettier
    ├── test/setup.ts          jest-dom + await i18nReady
    ├── test/router.tsx        Memory router + session fetch stub
    ├── auth/
    │   ├── client.ts          better-auth/react createAuthClient
    │   └── session.ts         api client + meQueryOptions
    ├── theme/
    │   ├── index.ts           DEFAULT_THEME, applyTheme, getTheme
    │   ├── default.css        [data-theme='default'] token values
    │   └── theme.test.ts
    └── routes/                File-based routes
        ├── __root.tsx         Header (RoadTo / RoadTo {projectName}), nav, sign out
        ├── __root.test.tsx
        ├── index.tsx          /
        ├── login.tsx          /login  (Google; redirects if signed in)
        ├── login.test.tsx
        ├── app.tsx            /app layout; session required
        └── app/
            ├── index.tsx      /app  (empty shell + API health)
            ├── index.test.tsx
            └── projects/
                ├── index.tsx          /app/projects  (create form, not persisted)
                └── $projectId.tsx     /app/projects/$projectId
```

**Routes today**

| URL | Page |
| --- | --- |
| `/` | Landing |
| `/login` | Google sign-in |
| `/app` | Signed-in shell (redirects to `/login` if no session) |
| `/app/projects` | Create project (name goes into the URL) |
| `/app/projects/:id?name=` | Project page; header becomes `RoadTo {name}` |

Vite proxies `http://127.0.0.1:5173/api/auth/*` to Fastify as-is, and other `/api/*` by stripping `/api` (`/api/health` → `/health`, `/api/v1/me` → `/v1/me`).

**Theming:** set `data-theme` on `<html>`. Tokens in `theme/default.css` (`--theme-canvas`, `--theme-ink`, …) are wired in `styles.css` `@theme` to utilities (`bg-canvas`, `text-ink`, `bg-accent`, `border-line`). A second theme is another `[data-theme='…']` file plus `applyTheme`.

---

## 6. `apps/api` — `@road-to/api`

Node Fastify process. Kysely + Better Auth Google. Session cookie via `/api/auth/*`.

```
apps/api/
├── package.json               tsx watch; `migrate` via kysely-ctl
├── tsconfig.json              extends packages/tsconfig/node.json
├── vitest.config.ts
├── kysely.config.ts           dialect `pg`, migrations/
├── migrations/
│   └── 20260923000000_auth_and_activities.ts
└── src/
    ├── env.ts                 DATABASE_URL, Better Auth, Google
    ├── db/
    │   ├── index.ts           Pool + Kysely
    │   └── types.ts           Database interface
    ├── auth.ts                betterAuth (Kysely/pg) + AuthLike for tests
    ├── auth-routes.ts         GET/POST /api/auth/*
    ├── app.ts                 buildApp — /health, /v1/me, auth
    ├── app.test.ts            Fastify inject, fake auth, no listen
    └── index.ts               listen PORT (default 3001)
```

`GET /v1/me` returns `{ user }` or 401. Health does not need a database.

---

## 7. `packages/domain` — `@road-to/domain`

Pure TypeScript. No React, no Fastify. Shared with a future mobile app.

```
packages/domain/
├── package.json               exports: "./src/index.ts"
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts               catalogs + formatBrandTitle; re-exports project-list
    ├── index.test.ts
    ├── project-list.ts        sortProjectActivityList (pinned race first)
    └── project-list.test.ts
```

Today it holds:

- Provider ids: `strava` \| `garmin` \| `whoop` \| `trainingpeaks`
- Activity visibility, health sample kinds
- Brand helper `formatBrandTitle('RoadTo', 'Marathon')` → `RoadTo Marathon`
- Project list order: one optional pinned activity at the top, then newest `startedAt`

Dedupe, field merge, and auto-assign rules will land here as functions with fixtures (see implementation plan).

---

## 8. `packages/api-client` — `@road-to/api-client`

Typed `fetch` wrapper for the HTTP API.

```
packages/api-client/src/
├── index.ts         createApiClient, ApiError, health(), me()
└── index.test.ts    mocked fetch
```

Web uses `createApiClient({ baseUrl: '/api' })` with `credentials: 'include'` so the session cookie is sent. More methods (`activities`, `projects`) are added as the API grows.

---

## 9. `packages/i18n` — `@road-to/i18n`

Locale catalogs. English only for v1; no user-facing copy should be hardcoded in React.

```
packages/i18n/src/
├── index.ts
├── index.test.ts
└── locales/en.json            appName, nav, auth, shell, projects
```

`appName` is **RoadTo**. Web `i18n.ts` loads `resources` and `defaultNS` from this package.

---

## 10. `packages/tsconfig` — `@road-to/tsconfig`

JSON configs only (no `src`).

| File | Used by |
| --- | --- |
| `base.json` | Strict TS, NodeNext. Libraries. |
| `node.json` | API (`noEmit`, `@types/node`) |
| `react.json` | Web (`jsx: react-jsx`, DOM, bundler resolution) |

App tsconfigs **extend by relative path** (e.g. `../../packages/tsconfig/react.json`) so the editor always resolves them. `apps/web/tsconfig.json` also sets `"jsx": "react-jsx"` itself.

---

## 11. `docs/`

| File | What it is |
| --- | --- |
| `requirements.md` | Product: auth, providers, dedupe/merge, projects, pin, sharing, i18n, branding |
| `implementation-plan.md` | Stack, data model, sync, API sketch, phases 0–8 |
| `repository.md` | This file — layout of the monorepo |
| `auth.md` | Google OAuth + session cookie workflow |

---

## 12. Tests and CI

- **Runner:** Vitest. Root `pnpm test` runs all projects listed in `vitest.config.ts`.
- **Web:** jsdom + Testing Library. Router tests use `createMemoryHistory` + `router.load()`.
- **API:** Fastify `inject()` (no TCP listen).
- **CI:** GitHub Actions on PRs and on push to `main`.

Generated TanStack files (`*.gen.ts`) are excluded from ESLint/Prettier. `vite.config.ts` ignores `*.test.ts(x)` inside `src/routes` so tests are not treated as routes.

---

## 13. Adding something new

**New shared library**

1. Create `packages/<name>/package.json` with `"name": "@road-to/<name>"` and `"exports"`.
2. Add `tsconfig.json` extending `../tsconfig/base.json`.
3. Depend from an app with `"@road-to/<name>": "workspace:*"`.
4. Add the folder to root `vitest.config.ts` `projects` if it has tests.
5. Add it to the root `typecheck` script.

**New app** (e.g. mobile)

1. Create `apps/mobile` (workspace glob already includes `apps/*`).
2. Depend on `domain`, `api-client`, `i18n` — not on `web` components.

**New theme**

1. Add `apps/web/src/theme/<name>.css` with `[data-theme='<name>'] { --theme-… }`.
2. Import it from `styles.css`.
3. Extend `themeNames` in `theme/index.ts` and call `applyTheme('<name>')`.

**New route**

Add a file under `apps/web/src/routes/` following TanStack file routing. Run `pnpm --filter @road-to/web dev` or `build` so `routeTree.gen.ts` regenerates.
