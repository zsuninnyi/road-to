import { randomUUID } from 'node:crypto';
import { isHydratedStravaPayload, type Sport } from '@road-to/domain';
import type {
  ActivityRecord,
  IntegrationRecord,
  IntegrationRepository,
  PublicActivity,
  UpsertIntegrationInput,
} from './types.js';

type StoredActivity = {
  id: string;
  userId: string;
  titleOverridden: boolean;
  sport: Sport;
  title: string;
  startedAt: string;
  endedAt: string;
  timezone: string | null;
  distanceM: number | null;
  movingTimeS: number | null;
  elapsedTimeS: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgSpeedMps: number | null;
  calories: number | null;
  mapPolyline: string | null;
};

type StoredSource = {
  id: string;
  activityId: string;
  integrationId: string;
  provider: 'strava';
  externalId: string;
  payload: Record<string, unknown>;
};

function toPublic(row: StoredActivity): PublicActivity {
  return {
    id: row.id,
    sport: row.sport,
    title: row.title,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    distanceM: row.distanceM,
    movingTimeS: row.movingTimeS,
    elapsedTimeS: row.elapsedTimeS,
    elevationGainM: row.elevationGainM,
    avgHr: row.avgHr,
    mapPolyline: row.mapPolyline,
    sources: [{ provider: 'strava' }],
  };
}

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

  function sourceForActivity(activityId: string): StoredSource | undefined {
    return [...sources.values()].find((item) => item.activityId === activityId);
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
      if (
        existingSource &&
        isHydratedStravaPayload(existingSource.payload) &&
        !isHydratedStravaPayload(input.payload)
      ) {
        return;
      }
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
        timezone: input.normalized.timezone,
        distanceM: input.normalized.distanceM,
        movingTimeS: input.normalized.movingTimeS,
        elapsedTimeS: input.normalized.elapsedTimeS,
        elevationGainM: input.normalized.elevationGainM,
        avgHr: input.normalized.avgHr,
        maxHr: input.normalized.maxHr,
        avgSpeedMps: input.normalized.avgSpeedMps,
        calories: input.normalized.calories,
        mapPolyline: input.normalized.mapPolyline,
      });
      sources.set(key, {
        id: sourceId,
        activityId,
        integrationId: input.integrationId,
        provider: 'strava',
        externalId: input.normalized.externalId,
        payload: input.payload,
      });
    },
    async listActivities(userId) {
      return [...activities.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
        .map(toPublic);
    },
    async getActivityById(userId, id) {
      const row = activities.get(id);
      const source = sourceForActivity(id);
      if (!row || row.userId !== userId || !source) {
        return null;
      }
      const record: ActivityRecord = {
        ...row,
        integrationId: source.integrationId,
        externalId: source.externalId,
        payload: source.payload,
      };
      return record;
    },
  };
}
