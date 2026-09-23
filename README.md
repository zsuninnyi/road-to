# road-to

A fitness journal that pulls activities and health data from Garmin, Strava, Whoop, and TrainingPeaks, deduplicates them, groups them into projects (for example “Road to Marathon”), and lets the owner share selected lists and activities.

Web first (React). A React Native app may follow.

## Documents

- [Initial requirements](docs/requirements.md) — product scope, user-facing behavior, non-goals, provider risks.
- [Implementation plan](docs/implementation-plan.md) — architecture, stack, data model, sync/dedupe, API sketch, and phased build order.
- [Repository structure](docs/repository.md) — workspaces, packages, directories, and how they connect.
- [Auth workflow](docs/auth.md) — Google OAuth, session cookie, `/v1/me`, protected `/app`.
- [Strava integration](docs/strava.md) — OAuth connect, last-30-day import, activity list.

## Repository layout

```
apps/api          Fastify API
apps/web          Vite + React + TanStack
packages/domain   Shared types
packages/api-client
packages/i18n     Locale catalogs (English first)
packages/tsconfig Shared TypeScript configs
```

## Local development

Requires Node 22+ (see `.nvmrc`). This repo uses pnpm via Corepack:

```sh
cp .env.example .env          # add Google + Strava client ids/secrets
docker compose up -d postgres
corepack pnpm install
corepack pnpm migrate
corepack pnpm dev
```

- Web: http://127.0.0.1:5173
- API health: http://127.0.0.1:3001/health
- OpenAPI UI: http://127.0.0.1:3001/docs (also proxied at http://127.0.0.1:5173/docs)
- Google callback (register in Google Cloud): `http://127.0.0.1:5173/api/auth/callback/google`
- Strava API app: Website `http://127.0.0.1:5173`, Authorization Callback Domain `127.0.0.1` (domain only). The redirect we send is `http://127.0.0.1:5173/api/v1/integrations/strava/callback`.

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
```

## Intended stack

| Layer    | Choice                                                                                 |
| -------- | -------------------------------------------------------------------------------------- |
| Web      | React, TypeScript, Vite, TanStack Router / Query / Table / Form, Tailwind CSS, i18next |
| API      | Node.js, Fastify                                                                       |
| Database | PostgreSQL via Kysely                                                                  |
| Deploy   | Docker images for API, worker, and web                                                 |
| Later    | React Native (Expo), Redis / object storage if scale requires it                       |

## License

MIT. See [LICENSE](LICENSE).
