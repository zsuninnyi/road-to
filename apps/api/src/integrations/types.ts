import type { NormalizedProviderActivity, Sport } from '@road-to/domain';

export type IntegrationStatus = 'active' | 'expired' | 'error' | 'revoked';

export type IntegrationRecord = {
  id: string;
  userId: string;
  provider: 'strava';
  externalUserId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: Date;
  scopes: string;
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
};

export type PublicIntegration = {
  id: string;
  provider: 'strava';
  status: IntegrationStatus;
  externalUserId: string;
  lastSyncAt: string | null;
};

export type PublicActivity = {
  id: string;
  sport: Sport;
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

export type UpsertIntegrationInput = {
  userId: string;
  provider: 'strava';
  externalUserId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: Date;
  scopes: string;
};

export type IntegrationRepository = {
  getByUserAndProvider(userId: string, provider: 'strava'): Promise<IntegrationRecord | null>;
  getById(userId: string, id: string): Promise<IntegrationRecord | null>;
  listByUser(userId: string): Promise<IntegrationRecord[]>;
  upsert(input: UpsertIntegrationInput): Promise<IntegrationRecord>;
  updateTokens(
    id: string,
    input: {
      accessTokenEnc: string;
      refreshTokenEnc: string;
      expiresAt: Date;
      status: IntegrationStatus;
      lastError: string | null;
    },
  ): Promise<void>;
  markSync(
    id: string,
    input: { lastSyncAt: Date; lastError: string | null; status: IntegrationStatus },
  ): Promise<void>;
  upsertStravaActivity(input: {
    userId: string;
    integrationId: string;
    normalized: NormalizedProviderActivity;
    payload: Record<string, unknown>;
  }): Promise<void>;
  listActivities(userId: string): Promise<PublicActivity[]>;
};
