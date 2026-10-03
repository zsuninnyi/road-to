import type {
  ActivityStreamsDto,
  ActivityVisibility,
  NormalizedProviderActivity,
  Sport,
  Units,
} from '@road-to/domain';

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
  description: string | null;
  visibility: ActivityVisibility;
  sources: Array<{ provider: 'strava' }>;
};

export type PublicActivityDetail = PublicActivity & {
  timezone: string | null;
  maxHr: number | null;
  avgSpeedMps: number | null;
  calories: number | null;
  titleOverridden: boolean;
  hydrated: boolean;
  streams: ActivityStreamsDto | null;
};

export type ActivityRecord = {
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
  description: string | null;
  visibility: ActivityVisibility;
  integrationId: string;
  externalId: string;
  payload: unknown;
};

export type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  sport: Sport;
  visibility: ActivityVisibility;
  windowStart: string | null;
  windowEnd: string | null;
};

export type PublicUser = {
  name: string;
  image: string | null;
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
  getActivityById(userId: string, id: string): Promise<ActivityRecord | null>;
  findActivityByExternalId(userId: string, externalId: string): Promise<ActivityRecord | null>;
  getIntegrationByExternalUserId(externalUserId: string): Promise<IntegrationRecord | null>;
  getUserUnits(userId: string): Promise<Units>;
  listProjects(userId: string): Promise<ProjectRecord[]>;
  getProject(userId: string, id: string): Promise<ProjectRecord | null>;
  findProject(id: string): Promise<ProjectRecord | null>;
  getPublicUser(userId: string): Promise<PublicUser | null>;
  createProject(
    userId: string,
    input: { name: string; sport: Sport; windowStart: string | null; windowEnd: string | null },
  ): Promise<ProjectRecord>;
  updateProjectFields(
    userId: string,
    id: string,
    fields: {
      visibility?: ActivityVisibility;
      windowStart?: string | null;
      windowEnd?: string | null;
    },
  ): Promise<ProjectRecord | null>;
  linkProjectActivity(projectId: string, activityId: string): Promise<void>;
  listExcludedActivityIds(projectId: string): Promise<string[]>;
  excludeProjectActivity(projectId: string, activityId: string): Promise<void>;
  restoreProjectActivity(projectId: string, activityId: string): Promise<void>;
  updateActivityFields(
    userId: string,
    id: string,
    fields: {
      description?: string | null;
      title?: string;
      titleOverridden?: boolean;
      visibility?: ActivityVisibility;
    },
  ): Promise<ActivityRecord | null>;
};
