# Road To — Initial Requirements

**Status:** draft, pre-implementation  
**Date:** 2026-09-21  
**Audience:** product + engineering

Road To is a personal fitness training journal. Athletes connect Garmin, Strava, Whoop, and TrainingPeaks, land on one canonical activity list, group work into projects such as “Road to Marathon,” and share selected views with others.

This document captures what v1 should do. Display metrics per sport, aggregation formulas, and visual design will be specified later. Implementation details live in [implementation-plan.md](./implementation-plan.md).

---

## 1. Product vision

Athletes already record training in several places. Those records overlap, stay private or public inconsistently, and are hard to present as a single training story.

Road To should:

1. Import activities and health data from the connected providers.
2. Deduplicate the same session when it appears in more than one source, and merge complementary fields so the stored activity is the union of what each platform knows.
3. Let the athlete own visibility, notes, and grouping (projects).
4. Present lists, a single activity, and a project as shareable pages.
5. Aggregate training and health over time — first at a coarse level, then with richer formulas once those are specified.

The web app is the first product. A React Native app may follow and should reuse domain logic and, where practical, UI building blocks.

---

## 2. Goals and non-goals

### Goals (v1)

- Sign in with Google and Sign in with Apple.
- Connect at least one live activity provider and import history plus ongoing updates.
- Store imported data locally so lists, maps, notes, and projects work without hitting provider APIs on every page load.
- Let the user trigger a full or partial resync without losing notes, visibility, or project assignments.
- Deduplicate cross-provider copies of the same activity, fill gaps from other sources into the stored canonical record, and let the user fix a bad merge.
- Flag each activity public or private.
- Create projects, assign activities manually, and auto-assign by a time window plus sport filter.
- List all activities and list only the activities in a project.
- Add a description / comment on an activity.
- Show an activity page with map (when GPS exists) plus core stats (distance, duration, pace, and similar; exact fields per sport later).
- Share an activity, a project list, or the full public activity list via a link.
- Basic aggregations: training volume by sport and period; sleep / recovery totals when health data exists. Exact metrics later.

### Non-goals (v1)

- Social graph, follow/followers, likes, or a public feed of strangers.
- Coaching other athletes or multi-athlete team accounts.
- Writing workouts back to Garmin / TrainingPeaks / Whoop.
- Live segments, race results, or route planning.
- Nutrition, weight programs, or gear inventory.
- Native mobile app (architecture should not block it).
- Pixel-perfect sport-specific analysis screens (power curves, lap analysis, Whoop strain charts, etc.).
- Billing / subscriptions.

---

## 3. Users and accounts

| Role | Description |
| --- | --- |
| Owner | Registered user. Connects providers, owns activities, projects, notes, and share links. |
| Viewer | Anyone with a valid share link. Sees only what that link is allowed to show. No account required. |

- Registration and login: **Google** and **Apple** only (no password accounts in v1).
- One Road To user per Google or Apple identity. Linking both identities to the same user is desirable but can ship after first login works.
- Account deletion must disconnect providers (revoke tokens where the API allows it) and delete stored personal data.

---

## 4. Functional requirements

### 4.1 Authentication

- User can register / log in with Google.
- User can register / log in with Apple.
- Session persists across browser restarts until the user signs out or the session expires.
- Unauthenticated users can open valid share links; all other app pages redirect to login.

### 4.2 Provider connections

The user can connect and disconnect:

| Provider | Expected data | Notes |
| --- | --- | --- |
| Strava | Activities, GPS streams, core stats | Public developer API. Primary v1 source. |
| Whoop | Workouts, sleep, recovery / strain | Public developer API; production access is gated after a small test cap. |
| Garmin | Activities (incl. FIT) and daily health | Partner program. New applications are currently paused. |
| TrainingPeaks | Completed workouts, some wellness metrics | Partner API. New partners are currently paused; not for personal-only use. |

Requirements that apply to every provider:

- OAuth consent is explicit. The app stores only the scopes it needs.
- Connection status is visible (connected, expired, error, disconnected).
- Disconnecting stops sync and, on user request, can either keep already imported data or delete that provider’s source records.
- A failed or expired token is surfaced; the user can reconnect without losing local notes and assignments.

Garmin and TrainingPeaks remain in the product design even if they cannot be enabled on day one. The app must not assume every user has every provider.

### 4.3 Activity import, storage, and resync

- On first connect, import historical activities (bounded window, e.g. last 2 years, configurable later).
- After that, keep the library up to date via provider webhooks where they exist, otherwise periodic pull.
- Persist a **canonical activity** plus **per-provider source records** (raw payload + normalized fields).
- The user can resync:
  - a single activity,
  - a provider,
  - or all providers.
- Resync refreshes stats, map/stream data, and provider metadata. It must **not** wipe user-owned fields: description, visibility, project assignments, merge decisions.
- If the provider deleted an activity, mark the local source as deleted. If no other source remains, hide the canonical activity from default lists (keep it if the user already annotated or assigned it, and show a “missing on provider” state).

### 4.4 Deduplication and field merge

The same real-world session often appears on Garmin and Strava (and sometimes Whoop / TrainingPeaks). Those copies are rarely identical: one platform may have the GPS track, another heart rate, another a better title.

- The system automatically groups likely duplicates into one canonical activity.
- Matching uses a conservative fingerprint: start time window, duration, distance, sport family, and GPS overlap when both sides have a map.
- After a match, **merge complementary data** into the stored canonical activity. If a field is present on one source and missing on the others, take it. Do not require a single provider to win every column.
- Each canonical field records **provenance** (which source supplied it). The UI shows provider badges for contributing sources and can show, per stat, where it came from.
- When two sources both have a value and they disagree, use the per-field ranking in the implementation plan (GPS-heavy fields prefer Garmin, titles prefer Strava, and so on). The user can set a preferred source that wins **conflicts**, not the whole record.
- Source records always keep their original payloads so a split, resync, or re-merge is possible.
- The user can confirm a suggested merge or split a bad merge.
- Lists, projects, and aggregations always use the merged canonical activity, never raw provider copies.
- Whoop sleeps are **not** activities and are never merged into a workout. They are health metrics only. A Whoop *workout* may still merge with a Strava/Garmin session (for example heart rate filling a gap on a GPS activity).

Dedup is best-effort. Ambiguous matches should stay separate rather than silently merge.

### 4.5 Activity list and detail

**All-activities list**

- Chronological list of the owner’s canonical activities.
- Filters at minimum: date range, sport, provider, project, public/private.
- Each row shows sport, title, start time, distance and/or duration, visibility, and source badges.

**Activity detail**

- Title defaults to the provider title (after merge, usually Strava’s when present). The owner can override it; resync must not clobber an override. Clearing the override restores the merged provider title.
- Map when GPS data exists; a clear empty state when it does not (e.g. treadmill, strength, Whoop workout without polyline).
- Core stats: distance, moving/elapsed time, pace or speed, elevation, heart rate when present. Per-sport extra fields are specified later. Where a stat was filled from a different source than the map, the UI may show that.
- Provider badges using each platform’s branding (name and allowed logo/mark) for every source that contributed.
- Visibility toggle: **private** (default) or **public**.
- Owner description / comment field (plain text in v1).
- Resync action.

“Comment” in v1 means the owner’s note on the activity, not a public discussion thread.

### 4.6 Privacy of activities

- Default visibility: **private**.
- Private activities appear only to the owner (and on an activity-level share link if the owner explicitly creates one for that activity).
- Public activities may appear on the owner’s shared activity list and on shared project pages.
- Changing visibility is immediate for subsequent share-page loads.

### 4.7 Projects

A project is a named container for a training goal, e.g. “Road to Marathon”.

- Owner can create, rename, describe, archive, and delete a project.
- An activity can belong to **multiple** projects.
- **Manual assignment:** add/remove activities one by one from the activity page or a project picker.
- **Auto-assignment rule:** a project may define one or more rules, each with:
  - date window (start, end),
  - sport filter (e.g. all runs; all bikes; all sports),
  - optional further filters later (min distance, etc.).
- When a rule is saved, matching existing activities are assigned.
- Newly imported activities that match a rule are assigned automatically.
- Manual removal from a project is sticky: auto-rules must not re-add an activity the owner explicitly removed (unless the owner clears that override).
- **Project activity list:** same list/detail capabilities as the global list, scoped to that project.
- Deleting a project does not delete activities.

### 4.8 Aggregations

Exact formulas will be specified later. v1 should still support the data shape and a first set of rollups:

- Training: distance, moving time, activity count, elevation — by day / week / month, by sport, globally or per project.
- Health (when present): sleep duration, sleep nights counted, recovery score or HRV if the connected provider supplies them — by day / week / month.

Aggregations always use merged canonical activities (deduped, gap-filled). Health samples are separate from activities: **sleep is a health metric, never an activity**.

### 4.9 Sharing

The owner can create a share link for:

| Share target | Viewer sees |
| --- | --- |
| Single activity | Owner name and photo, that activity’s public-facing detail (map + stats + owner note), and source badges. Private activities are shareable only via this explicit link. |
| Project | Owner name and photo, project name, description, activity list, and project aggregations, **public activities only** (plus any activity that was individually shared is not automatically included unless it is public). |
| All activities | Owner name and photo, the owner’s public activity list, and global public aggregations. |

Rules:

- Links are unlisted (secret token in the URL), not searchable inside the product.
- The owner can revoke a link at any time.
- Viewers cannot see private activities, provider tokens, or account settings.
- v1 does not require the viewer to log in.
- Share pages always show the owner’s display name and profile photo (from Google/Apple, overridable in settings).
- Optional later: expiry, password, and Open Graph previews.

### 4.10 Settings (minimum)

- Profile display name and photo.
- Connected providers.
- Unit preference: metric / imperial.
- Sign out and delete account.

Language switcher is not required in v1 (English copy only), but every user-facing string still goes through the i18n catalog so more locales can be added later.

---

## 5. Information architecture (web)

```
/login
/app                          dashboard + recent aggregations
/app/activities               all activities
/app/activities/:id           activity detail
/app/projects                 project list
/app/projects/:id             project + its activities + aggregations
/app/health                   health rollups (can be a dashboard section at first)
/app/settings
/share/:token                 public share view (activity | project | list)
```

Mobile, later, maps onto the same resources with native navigation rather than these URLs.

---

## 6. Domain glossary

| Term | Meaning |
| --- | --- |
| Provider | Garmin, Strava, Whoop, or TrainingPeaks. |
| Source record | One imported object from one provider, with the original id and payload. |
| Canonical activity | The deduped session the product lists and assigns to projects; stats are a field-level merge of its sources. |
| Health sample | A non-activity metric (sleep, recovery, HRV, steps) for a time range or day. Sleep is never listed as an activity. |
| Field provenance | Which provider supplied each canonical field after merge. |
| Project | Owner-defined grouping of canonical activities, with optional auto-rules. |
| Visibility | `private` or `public` on a canonical activity (and later on a project). |
| Share link | Unlisted URL that exposes a specific resource to viewers. |
| Resync | Re-fetch provider data and rebuild normalized fields without dropping user-owned data. |

---

## 7. Non-functional requirements

- **Web first.** Desktop and mobile browsers. Responsive layout.
- **TypeScript** end to end.
- **i18n from day one.** All UI strings live in a catalog. The only locale in v1 is English.
- **Performance:** activity lists remain usable at several thousand activities (pagination or virtualization).
- **Sync honesty:** importing 2 years of data may take minutes; the UI must show progress/status, not a silent hang.
- **Security:** OAuth tokens encrypted at rest; HTTPS only; share tokens unguessable; owner APIs require a session.
- **Privacy:** do not send user data to a provider that did not originate it. Do not expose private activities on list/project share pages.
- **Observability:** structured logs for sync jobs, provider errors, and auth failures.
- **Testability:** domain rules (dedupe, auto-assign, visibility on shares) are unit-testable without calling live provider APIs.

---

## 8. Constraints from later mobile

- All mutations and queries go through a versioned HTTP API. The web app is a client, not the source of truth.
- Business rules (dedupe, auto-assign, aggregations, share authorization) live on the server or in a shared TypeScript package, not only in React components.
- Visual components should be designed so that list rows, stat blocks, and project headers can later be reimplemented or shared with React Native. Pixel-identical sharing of web DOM components is not a v1 requirement.

See the implementation plan for the recommended split between shared packages and platform UI.

---

## 9. Provider access risks (product impact)

These are product constraints, not just engineering notes:

1. **Strava** is the only activity API that can be integrated immediately with a normal developer account. Rate limits are strict; webhooks are required for ongoing sync.
2. **Whoop** can be integrated via their developer portal. New apps are limited to a small member cap until Whoop approves production access. Whoop workouts often lack GPS maps.
3. **Garmin Connect Developer Program** has paused new API access applications (as of 2026, no reopen date announced). Existing approved apps still work. A willing user cannot bypass missing developer approval.
4. **TrainingPeaks** is partner-gated, currently not accepting new partners, and is not available for personal-only use.

v1 of the product must be valuable with **Strava alone**, then Whoop for health. Garmin and TrainingPeaks ship behind the same connection UI when credentials exist.

The app is **personal first**, not a public marketplace. Provider API terms and branding still apply: mark the data source in the UI (name + allowed logo), do not imply we originated Garmin/Strava/Whoop/TrainingPeaks data, and do not rebrand their marks.

---

## 10. Open questions

Still open:

1. Historical import window: last 12 months, 24 months, or all available? (planning default remains 24 months.)
2. Should a project itself have public/private, separate from its activities? (planning default: project share pages show public activities only; no separate project visibility flag yet.)

Decided:

| # | Decision |
| --- | --- |
| 3 | Share pages show the owner’s name and photo. |
| 4 | Default title comes from the provider (merged). The owner can override it; resync does not overwrite an override. |
| 5 | Sleeps are health metrics only, never activities. |
| 6 | Wire i18n from the start; ship English only in v1. |
| 7 | Personal app first, but still attribute sources in the UI and follow each provider’s branding and API terms. |

---

## 11. Success criteria for v1

A user can:

1. Sign in with Google or Apple.
2. Connect Strava and see a deduped activity list with maps on outdoor sessions.
3. Mark activities private/public and add a note.
4. Create “Road to Marathon,” auto-assign runs in a date window, and also pin a specific session by hand.
5. Open a share link for that project as a logged-out viewer and see the owner’s name and photo plus only public activities.
6. Hit resync and keep the note, visibility, and project membership.
7. See a monthly total for running distance (and sleep hours if Whoop is connected).
