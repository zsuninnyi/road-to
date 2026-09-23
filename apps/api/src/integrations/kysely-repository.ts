import { randomUUID } from 'node:crypto';
import { activityFingerprint, type NormalizedProviderActivity } from '@road-to/domain';
import type { Kysely } from 'kysely';
import type { Database, IntegrationStatus } from '../db/types.js';
import type {
  IntegrationRecord,
  IntegrationRepository,
  PublicActivity,
  UpsertIntegrationInput,
} from './types.js';

function json(value: unknown): string {
  return JSON.stringify(value);
}

function toRecord(row: {
  id: string;
  user_id: string;
  provider: string;
  external_user_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: Date | string;
  scopes: string;
  status: IntegrationStatus;
  last_sync_at: Date | string | null;
  last_error: string | null;
}): IntegrationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: 'strava',
    externalUserId: row.external_user_id,
    accessTokenEnc: row.access_token_enc,
    refreshTokenEnc: row.refresh_token_enc,
    expiresAt: new Date(row.expires_at),
    scopes: row.scopes,
    status: row.status,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
    lastError: row.last_error,
  };
}

function canonicalColumns(normalized: NormalizedProviderActivity, sourceId: string) {
  return {
    sport: normalized.sport,
    title: normalized.title,
    started_at: new Date(normalized.startedAt),
    ended_at: new Date(normalized.endedAt),
    timezone: normalized.timezone,
    distance_m: normalized.distanceM,
    moving_time_s: normalized.movingTimeS,
    elapsed_time_s: normalized.elapsedTimeS,
    elevation_gain_m: normalized.elevationGainM,
    avg_hr: normalized.avgHr,
    max_hr: normalized.maxHr,
    avg_speed_mps: normalized.avgSpeedMps,
    calories: normalized.calories,
    map_polyline: normalized.mapPolyline,
    field_sources: json({
      title: sourceId,
      distance_m: sourceId,
      map_polyline: sourceId,
      moving_time_s: sourceId,
      elapsed_time_s: sourceId,
    }),
    preferred_source_id: sourceId,
  };
}

export function createKyselyIntegrationRepository(db: Kysely<Database>): IntegrationRepository {
  return {
    async getByUserAndProvider(userId, provider) {
      const row = await db
        .selectFrom('integrations')
        .selectAll()
        .where('user_id', '=', userId)
        .where('provider', '=', provider)
        .executeTakeFirst();
      return row ? toRecord(row) : null;
    },
    async getById(userId, id) {
      const row = await db
        .selectFrom('integrations')
        .selectAll()
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return row ? toRecord(row) : null;
    },
    async listByUser(userId) {
      const rows = await db
        .selectFrom('integrations')
        .selectAll()
        .where('user_id', '=', userId)
        .execute();
      return rows.map(toRecord);
    },
    async upsert(input: UpsertIntegrationInput) {
      const existing = await db
        .selectFrom('integrations')
        .selectAll()
        .where('user_id', '=', input.userId)
        .where('provider', '=', input.provider)
        .executeTakeFirst();
      const id = existing?.id ?? randomUUID();
      await db
        .insertInto('integrations')
        .values({
          id,
          user_id: input.userId,
          provider: input.provider,
          external_user_id: input.externalUserId,
          access_token_enc: input.accessTokenEnc,
          refresh_token_enc: input.refreshTokenEnc,
          expires_at: input.expiresAt,
          scopes: input.scopes,
          status: 'active',
          last_error: null,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'provider']).doUpdateSet({
            external_user_id: input.externalUserId,
            access_token_enc: input.accessTokenEnc,
            refresh_token_enc: input.refreshTokenEnc,
            expires_at: input.expiresAt,
            scopes: input.scopes,
            status: 'active',
            last_error: null,
            updated_at: new Date(),
          }),
        )
        .execute();
      const row = await db
        .selectFrom('integrations')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      return toRecord(row);
    },
    async updateTokens(id, input) {
      await db
        .updateTable('integrations')
        .set({
          access_token_enc: input.accessTokenEnc,
          refresh_token_enc: input.refreshTokenEnc,
          expires_at: input.expiresAt,
          status: input.status,
          last_error: input.lastError,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
    },
    async markSync(id, input) {
      await db
        .updateTable('integrations')
        .set({
          last_sync_at: input.lastSyncAt,
          last_error: input.lastError,
          status: input.status,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
    },
    async upsertStravaActivity(input) {
      await db.transaction().execute(async (trx) => {
        const existing = await trx
          .selectFrom('activity_sources')
          .innerJoin('activities', 'activities.id', 'activity_sources.activity_id')
          .select([
            'activity_sources.id as source_id',
            'activity_sources.activity_id as activity_id',
            'activities.title_overridden as title_overridden',
            'activities.title as title',
          ])
          .where('activity_sources.provider', '=', 'strava')
          .where('activity_sources.external_id', '=', input.normalized.externalId)
          .executeTakeFirst();

        const sourceId = existing?.source_id ?? randomUUID();
        const activityId = existing?.activity_id ?? randomUUID();
        const columns = canonicalColumns(input.normalized, sourceId);
        const title = existing?.title_overridden ? existing.title : input.normalized.title;
        const fingerprint = activityFingerprint(input.normalized);

        if (!existing) {
          await trx
            .insertInto('activities')
            .values({
              id: activityId,
              user_id: input.userId,
              ...columns,
              title,
              visibility: 'private',
              title_overridden: false,
            })
            .execute();
        } else {
          await trx
            .updateTable('activities')
            .set({
              ...columns,
              title,
            })
            .where('id', '=', activityId)
            .execute();
        }

        await trx
          .insertInto('activity_sources')
          .values({
            id: sourceId,
            activity_id: activityId,
            integration_id: input.integrationId,
            provider: 'strava',
            external_id: input.normalized.externalId,
            payload: json(input.payload),
            fingerprint,
            has_gps: input.normalized.hasGps,
            started_at: new Date(input.normalized.startedAt),
            distance_m: input.normalized.distanceM,
            duration_s: input.normalized.elapsedTimeS,
            sport_raw: input.normalized.sportRaw,
          })
          .onConflict((oc) =>
            oc.columns(['provider', 'external_id']).doUpdateSet({
              payload: json(input.payload),
              fingerprint,
              has_gps: input.normalized.hasGps,
              started_at: new Date(input.normalized.startedAt),
              distance_m: input.normalized.distanceM,
              duration_s: input.normalized.elapsedTimeS,
              sport_raw: input.normalized.sportRaw,
              synced_at: new Date(),
              integration_id: input.integrationId,
            }),
          )
          .execute();
      });
    },
    async listActivities(userId) {
      const rows = await db
        .selectFrom('activities')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .orderBy('started_at', 'desc')
        .execute();

      const result: PublicActivity[] = rows.map((row) => ({
        id: row.id,
        sport: row.sport,
        title: row.title,
        startedAt: new Date(row.started_at).toISOString(),
        endedAt: new Date(row.ended_at).toISOString(),
        distanceM: row.distance_m,
        movingTimeS: row.moving_time_s,
        elapsedTimeS: row.elapsed_time_s,
        elevationGainM: row.elevation_gain_m,
        avgHr: row.avg_hr,
        mapPolyline: row.map_polyline,
        sources: [{ provider: 'strava' as const }],
      }));
      return result;
    },
  };
}
