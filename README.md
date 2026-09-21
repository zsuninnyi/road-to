# road-to

A fitness journal that pulls activities and health data from Garmin, Strava, Whoop, and TrainingPeaks, deduplicates them, groups them into projects (for example “Road to Marathon”), and lets the owner share selected lists and activities.

Web first (React). A React Native app may follow. No application code yet — planning only.

## Documents

- [Initial requirements](docs/requirements.md) — product scope, user-facing behavior, non-goals, provider risks.
- [Implementation plan](docs/implementation-plan.md) — architecture, stack, data model, sync/dedupe, API sketch, and phased build order.

## Intended stack

| Layer | Choice |
| --- | --- |
| Web | React, TypeScript, Vite, TanStack Router / Query / Table / Form, Tailwind CSS, i18next |
| API | Node.js, Fastify |
| Database | PostgreSQL (Docker Compose locally; managed in production) |
| Deploy | Docker images for API, worker, and web |
| Later | React Native (Expo), Redis / object storage if scale requires it |

## License

MIT. See [LICENSE](LICENSE).
