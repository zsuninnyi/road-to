import { randomUUID } from 'node:crypto';
import type { IntegrationRecord, IntegrationRepository, UpsertIntegrationInput } from './types.js';

type StoredActivity = {
  id: string;
  userId: string;
  titleOverridden: boolean;
  sport: import('@road-to/domain').Sport;
  title: string;
  startedAt: string;
  endedAt: string;
  distanceM: number | null;
  movingTimeS: number | null;
  elapsedTimeS: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  mapPolyline: string | null;
  sources: Array<{ provider: 'strava' }>;
};

type StoredSource = {
  id: string;
  activityId: string;
  provider: 'strava';
  externalId: string;
};

export function createMemoryIntegrationRepository(): IntegrationRepository {
  const integrations = new Map<string, IntegrationRecord>();
  const activities = new Map<string, StoredActivity>();
  const sources = new Map<string, StoredSource>();

  function clone(row: IntegrationRecord): IntegrationRecord {
    return {
      ...row,
      expiresAt: new Date(row.expiresAt),
      lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : null,
    };
  }

  return {
    async getByUserAndProvider(userId, provider) {
      const row = [...integrations.values()].find(
        (item) => item.userId === userId && item.provider === provider,
      );
      return row ? clone(row) : null;
    },
    async getById(userId, id) {
      const row = integrations.get(id);
      if (!row || row.userId !== userId) {
        return null;
      }
      return clone(row);
    },
    async listByUser(userId) {
      return [...integrations.values()].filter((row) => row.userId === userId).map(clone);
    },
    async upsert(input: UpsertIntegrationInput) {
      const existing = [...integrations.values()].find(
        (row) => row.userId === input.userId && row.provider === input.provider,
      );
      const row: IntegrationRecord = {
        id: existing?.id ?? randomUUID(),
        userId: input.userId,
        provider: input.provider,
        externalUserId: input.externalUserId,
        accessTokenEnc: input.accessTokenEnc,
        refreshTokenEnc: input.refreshTokenEnc,
        expiresAt: input.expiresAt,
        scopes: input.scopes,
        status: 'active',
        lastSyncAt: existing?.lastSyncAt ?? null,
        lastError: null,
      };
      integrations.set(row.id, row);
      return clone(row);
    },
    async updateTokens(id, input) {
      const row = integrations.get(id);
      if (!row) {
        return;
      }
      integrations.set(id, { ...row, ...input });
    },
    async markSync(id, input) {
      const row = integrations.get(id);
      if (!row) {
        return;
      }
      integrations.set(id, { ...row, ...input });
    },
    async upsertStravaActivity(input) {
      const key = `strava:${input.normalized.externalId}`;
      const existingSource = sources.get(key);
      const existingActivity = existingSource
        ? activities.get(existingSource.activityId)
        : undefined;
      const activityId = existingActivity?.id ?? randomUUID();
      const sourceId = existingSource?.id ?? randomUUID();
      const title =
        existingActivity?.titleOverridden === true
          ? existingActivity.title
          : input.normalized.title;

      activities.set(activityId, {
        id: activityId,
        userId: input.userId,
        sport: input.normalized.sport,
        title,
        titleOverridden: existingActivity?.titleOverridden ?? false,
        startedAt: input.normalized.startedAt,
        endedAt: input.normalized.endedAt,
        distanceM: input.normalized.distanceM,
        movingTimeS: input.normalized.movingTimeS,
        elapsedTimeS: input.normalized.elapsedTimeS,
        elevationGainM: input.normalized.elevationGainM,
        avgHr: input.normalized.avgHr,
        mapPolyline: input.normalized.mapPolyline,
        sources: [{ provider: 'strava' }],
      });
      sources.set(key, {
        id: sourceId,
        activityId,
        provider: 'strava',
        externalId: input.normalized.externalId,
      });
    },
    async listActivities(userId) {
      return [...activities.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
        .map(({ userId: _userId, titleOverridden: _overridden, ...row }) => row);
    },
  };
}
