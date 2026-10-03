import {
  activityVisibilities,
  asJsonRecord,
  formatProjectProgressNote,
  isHydratedStravaPayload,
  normalizeStravaSummary,
  parseStravaStreams,
  parseStravaSummary,
  sports,
  stravaBackfillAfterUnix,
  trimStravaDetail,
  type ActivityVisibility,
  type Sport,
  type Units,
} from '@road-to/domain';
import { decryptSecret, encryptSecret } from '../crypto/tokens.js';
import { createOAuthState, readOAuthState } from './oauth-state.js';
import { StravaHttpError, stravaOAuthScopes, type StravaClient } from './strava-http.js';
import type {
  ActivityRecord,
  IntegrationRepository,
  PublicActivity,
  PublicActivityDetail,
  PublicIntegration,
} from './types.js';

export class StravaNotConfiguredError extends Error {
  constructor() {
    super('Strava is not configured');
    this.name = 'StravaNotConfiguredError';
  }
}

export class IntegrationNotFoundError extends Error {
  constructor() {
    super('Integration not found');
    this.name = 'IntegrationNotFoundError';
  }
}

export class ActivityNotFoundError extends Error {
  constructor() {
    super('Activity not found');
    this.name = 'ActivityNotFoundError';
  }
}

export type IntegrationSecrets = {
  tokenKey: Buffer;
  oauthSecret: string;
  stravaClientId: string;
  stravaClientSecret: string;
  redirectUri: string;
  webOrigin: string;
  webhookCallbackUrl?: string;
  webhookVerifyToken?: string;
};

export type IntegrationService = {
  listIntegrations(userId: string): Promise<PublicIntegration[]>;
  createConnectUrl(userId: string): Promise<{ url: string }>;
  handleCallback(input: {
    userId: string | null;
    code?: string;
    state?: string;
    error?: string;
  }): Promise<{ location: string }>;
  resync(userId: string, integrationId: string): Promise<{ imported: number }>;
  listActivities(userId: string): Promise<PublicActivity[]>;
  getActivity(userId: string, activityId: string): Promise<PublicActivityDetail>;
  resyncActivity(userId: string, activityId: string): Promise<PublicActivityDetail>;
  updateActivity(
    userId: string,
    activityId: string,
    input: {
      description?: string | null;
      title?: string | null;
      visibility?: ActivityVisibility;
    },
  ): Promise<PublicActivityDetail>;
  listProjects(userId: string): Promise<PublicProject[]>;
  getProject(userId: string, projectId: string): Promise<PublicProjectDetail>;
  createProject(
    userId: string,
    input: { name: string; sport: Sport },
  ): Promise<PublicProjectDetail>;
  readStravaWebhookChallenge(query: {
    mode?: string;
    challenge?: string;
    verifyToken?: string;
  }): { challenge: string } | null;
  acceptStravaWebhook(event: {
    objectType?: string;
    aspectType?: string;
    objectId?: number;
    ownerId?: number;
  }): Promise<void>;
  ensureStravaWebhook(): Promise<void>;
};

export type PublicProject = {
  id: string;
  name: string;
  sport: Sport;
  totalDistanceM: number;
  note: string | null;
};

export type PublicProjectDetail = PublicProject & {
  activities: PublicActivity[];
};

function toPublic(row: {
  id: string;
  provider: 'strava';
  status: PublicIntegration['status'];
  externalUserId: string;
  lastSyncAt: Date | null;
}): PublicIntegration {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    externalUserId: row.externalUserId,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
  };
}

function appRedirect(webOrigin: string, strava: string): { location: string } {
  const url = new URL('/app', webOrigin);
  url.searchParams.set('strava', strava);
  return { location: url.toString() };
}

function normalizeOwnerDescription(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function hasStravaActivityWrite(scopes: string): boolean {
  return scopes
    .split(/[,\s]+/)
    .filter((scope) => scope.length > 0)
    .includes('activity:write');
}

function providerTitleFromPayload(payload: unknown): string {
  const record = asJsonRecord(payload);
  const raw = isHydratedStravaPayload(record) ? record.activity : record;
  const parsed = parseStravaSummary(raw);
  return (parsed ? normalizeStravaSummary(parsed)?.title : null) ?? 'Untitled';
}

function toActivityDetail(row: ActivityRecord): PublicActivityDetail {
  const payload = asJsonRecord(row.payload);
  const hydrated = isHydratedStravaPayload(payload);
  return {
    id: row.id,
    sport: row.sport,
    title: row.title,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    timezone: row.timezone,
    distanceM: row.distanceM,
    movingTimeS: row.movingTimeS,
    elapsedTimeS: row.elapsedTimeS,
    elevationGainM: row.elevationGainM,
    avgHr: row.avgHr,
    maxHr: row.maxHr,
    avgSpeedMps: row.avgSpeedMps,
    calories: row.calories,
    mapPolyline: row.mapPolyline,
    description: row.description,
    visibility: row.visibility,
    sources: [{ provider: 'strava' }],
    titleOverridden: row.titleOverridden,
    hydrated,
    streams: hydrated ? parseStravaStreams(payload.streams) : null,
  };
}

export function createIntegrationService(options: {
  repo: IntegrationRepository;
  strava: StravaClient | null;
  secrets: IntegrationSecrets;
  now?: () => Date;
}): IntegrationService {
  const now = options.now ?? (() => new Date());
  const webhookCallbackUrl = options.secrets.webhookCallbackUrl ?? '';
  const webhookVerifyToken = options.secrets.webhookVerifyToken ?? 'road-to-strava';

  async function validAccessToken(integration: {
    id: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    expiresAt: Date;
  }): Promise<string> {
    if (!options.strava) {
      throw new StravaNotConfiguredError();
    }
    const accessToken = decryptSecret(integration.accessTokenEnc, options.secrets.tokenKey);
    if (integration.expiresAt.getTime() > now().getTime() + 60_000) {
      return accessToken;
    }
    const refreshToken = decryptSecret(integration.refreshTokenEnc, options.secrets.tokenKey);
    const tokens = await options.strava.refreshAccessToken(refreshToken);
    await options.repo.updateTokens(integration.id, {
      accessTokenEnc: encryptSecret(tokens.accessToken, options.secrets.tokenKey),
      refreshTokenEnc: encryptSecret(tokens.refreshToken, options.secrets.tokenKey),
      expiresAt: tokens.expiresAt,
      status: 'active',
      lastError: null,
    });
    return tokens.accessToken;
  }

  async function importRecent(userId: string, integrationId: string): Promise<number> {
    if (!options.strava) {
      throw new StravaNotConfiguredError();
    }
    const integration = await options.repo.getById(userId, integrationId);
    if (!integration) {
      throw new IntegrationNotFoundError();
    }

    try {
      const accessToken = await validAccessToken(integration);
      const afterUnix = stravaBackfillAfterUnix(now().getTime());
      let page = 1;
      let imported = 0;
      for (;;) {
        const batch = await options.strava.listActivities(accessToken, {
          afterUnix,
          page,
          perPage: 100,
        });
        if (batch.length === 0) {
          break;
        }
        for (const raw of batch) {
          const parsed = parseStravaSummary(raw);
          const normalized = parsed ? normalizeStravaSummary(parsed) : null;
          if (!normalized) {
            continue;
          }
          await storeStravaActivity(userId, integration, normalized, raw);
          imported += 1;
        }
        if (batch.length < 100) {
          break;
        }
        page += 1;
      }
      await options.repo.markSync(integrationId, {
        lastSyncAt: now(),
        lastError: null,
        status: 'active',
      });
      await applyProjectNotes(userId);
      return imported;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      const expired = error instanceof StravaHttpError && error.status === 401;
      await options.repo.markSync(integrationId, {
        lastSyncAt: integration.lastSyncAt ?? now(),
        lastError: message,
        status: expired ? 'expired' : 'error',
      });
      throw error;
    }
  }

  async function hydrateFromStrava(
    userId: string,
    row: ActivityRecord,
  ): Promise<PublicActivityDetail> {
    if (!options.strava) {
      throw new StravaNotConfiguredError();
    }
    const integration = await options.repo.getById(userId, row.integrationId);
    if (!integration) {
      throw new IntegrationNotFoundError();
    }
    const accessToken = await validAccessToken(integration);
    const activity = await options.strava.getActivity(accessToken, row.externalId);
    const streams = await options.strava.getStreams(accessToken, row.externalId);
    const parsed = parseStravaSummary(activity);
    const normalized = parsed ? normalizeStravaSummary(parsed) : null;
    if (!normalized) {
      return toActivityDetail(row);
    }
    const streamDto = parseStravaStreams(streams);
    await options.repo.upsertStravaActivity({
      userId,
      integrationId: row.integrationId,
      normalized: {
        ...normalized,
        hasGps: normalized.hasGps || (streamDto.latlng !== null && streamDto.latlng.length > 0),
      },
      payload: { activity: trimStravaDetail(activity), streams },
    });
    const updated = await options.repo.getActivityById(userId, row.id);
    return toActivityDetail(updated ?? row);
  }

  async function storeStravaActivity(
    userId: string,
    integration: {
      id: string;
      accessTokenEnc: string;
      refreshTokenEnc: string;
      expiresAt: Date;
    },
    normalized: NonNullable<ReturnType<typeof normalizeStravaSummary>>,
    raw: unknown,
  ): Promise<void> {
    const existing = await options.repo.findActivityByExternalId(userId, normalized.externalId);
    const alreadyFetched = existing ? isHydratedStravaPayload(asJsonRecord(existing.payload)) : false;
    if (!alreadyFetched && options.strava) {
      const accessToken = await validAccessToken(integration);
      const activity = await options.strava.getActivity(accessToken, normalized.externalId);
      const streams = await options.strava.getStreams(accessToken, normalized.externalId);
      const parsed = parseStravaSummary(activity);
      const detailed = parsed ? normalizeStravaSummary(parsed) : null;
      if (detailed) {
        const streamDto = parseStravaStreams(streams);
        await options.repo.upsertStravaActivity({
          userId,
          integrationId: integration.id,
          normalized: {
            ...detailed,
            hasGps: detailed.hasGps || (streamDto.latlng !== null && streamDto.latlng.length > 0),
          },
          payload: { activity: trimStravaDetail(activity), streams },
        });
        return;
      }
    }
    await options.repo.upsertStravaActivity({
      userId,
      integrationId: integration.id,
      normalized,
      payload: typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : { raw },
    });
  }

  async function fetchStravaActivityById(
    userId: string,
    integration: {
      id: string;
      accessTokenEnc: string;
      refreshTokenEnc: string;
      expiresAt: Date;
    },
    externalId: string,
  ): Promise<void> {
    if (!options.strava) {
      throw new StravaNotConfiguredError();
    }
    const accessToken = await validAccessToken(integration);
    const activity = await options.strava.getActivity(accessToken, externalId);
    const streams = await options.strava.getStreams(accessToken, externalId);
    const parsed = parseStravaSummary(activity);
    const normalized = parsed ? normalizeStravaSummary(parsed) : null;
    if (!normalized) {
      return;
    }
    const streamDto = parseStravaStreams(streams);
    await options.repo.upsertStravaActivity({
      userId,
      integrationId: integration.id,
      normalized: {
        ...normalized,
        hasGps: normalized.hasGps || (streamDto.latlng !== null && streamDto.latlng.length > 0),
      },
      payload: { activity: trimStravaDetail(activity), streams },
    });
  }

  function projectView(
    project: { id: string; name: string; sport: Sport },
    activities: PublicActivity[],
    units: Units,
  ): PublicProjectDetail {
    const matching = activities.filter((activity) => activity.sport === project.sport);
    const totalDistanceM = matching.reduce((sum, activity) => sum + (activity.distanceM ?? 0), 0);
    const note =
      matching.length > 0 ? formatProjectProgressNote(project.name, totalDistanceM, units) : null;
    return {
      id: project.id,
      name: project.name,
      sport: project.sport,
      totalDistanceM,
      note,
      activities: matching,
    };
  }

  async function applyProjectNotes(userId: string): Promise<void> {
    const projects = await options.repo.listProjects(userId);
    if (projects.length === 0) {
      return;
    }
    const units = await options.repo.getUserUnits(userId);
    const activities = await options.repo.listActivities(userId);
    for (const project of projects) {
      const view = projectView(project, activities, units);
      if (!view.note) {
        continue;
      }
      for (const activity of view.activities) {
        await options.repo.linkProjectActivity(project.id, activity.id);
        if (activity.description === view.note) {
          continue;
        }
        const row = await options.repo.getActivityById(userId, activity.id);
        if (!row) {
          continue;
        }
        await options.repo.updateActivityFields(userId, activity.id, { description: view.note });
        if (!options.strava) {
          continue;
        }
        const integration = await options.repo.getById(userId, row.integrationId);
        if (!integration || !hasStravaActivityWrite(integration.scopes)) {
          continue;
        }
        try {
          const accessToken = await validAccessToken(integration);
          await options.strava.updateActivity(accessToken, row.externalId, {
            description: view.note,
          });
        } catch {
          // The local note is already saved. A later edit can push it again.
        }
      }
    }
  }

  async function toPublicProject(userId: string, projectId: string): Promise<PublicProjectDetail> {
    const project = await options.repo.getProject(userId, projectId);
    if (!project) {
      throw new ActivityNotFoundError();
    }
    const units = await options.repo.getUserUnits(userId);
    const activities = await options.repo.listActivities(userId);
    return projectView(project, activities, units);
  }

  return {
    async listIntegrations(userId) {
      const rows = await options.repo.listByUser(userId);
      return rows.map(toPublic);
    },
    async createConnectUrl(userId) {
      if (!options.strava || !options.secrets.stravaClientId) {
        throw new StravaNotConfiguredError();
      }
      const state = createOAuthState(userId, options.secrets.oauthSecret, now().getTime());
      const url = new URL('https://www.strava.com/oauth/authorize');
      url.searchParams.set('client_id', options.secrets.stravaClientId);
      url.searchParams.set('redirect_uri', options.secrets.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('approval_prompt', 'force');
      url.searchParams.set('scope', stravaOAuthScopes);
      url.searchParams.set('state', state);
      return { url: url.toString() };
    },
    async handleCallback(input) {
      if (input.error === 'access_denied') {
        return appRedirect(options.secrets.webOrigin, 'denied');
      }
      if (!input.code || !input.state || !options.strava) {
        return appRedirect(options.secrets.webOrigin, 'error');
      }
      const parsed = readOAuthState(input.state, options.secrets.oauthSecret, now().getTime());
      if (!parsed || !input.userId || parsed.userId !== input.userId) {
        return appRedirect(options.secrets.webOrigin, 'error');
      }
      try {
        const tokens = await options.strava.exchangeCode(input.code);
        const integration = await options.repo.upsert({
          userId: parsed.userId,
          provider: 'strava',
          externalUserId: tokens.athleteId,
          accessTokenEnc: encryptSecret(tokens.accessToken, options.secrets.tokenKey),
          refreshTokenEnc: encryptSecret(tokens.refreshToken, options.secrets.tokenKey),
          expiresAt: tokens.expiresAt,
          scopes: tokens.scope ?? stravaOAuthScopes,
        });
        await importRecent(parsed.userId, integration.id);
        return appRedirect(options.secrets.webOrigin, 'connected');
      } catch {
        return appRedirect(options.secrets.webOrigin, 'error');
      }
    },
    async resync(userId, integrationId) {
      const imported = await importRecent(userId, integrationId);
      return { imported };
    },
    async listActivities(userId) {
      return options.repo.listActivities(userId);
    },
    async getActivity(userId, activityId) {
      const row = await options.repo.getActivityById(userId, activityId);
      if (!row) {
        throw new ActivityNotFoundError();
      }
      if (isHydratedStravaPayload(asJsonRecord(row.payload)) || !options.strava) {
        return toActivityDetail(row);
      }
      return hydrateFromStrava(userId, row);
    },
    async resyncActivity(userId, activityId) {
      const row = await options.repo.getActivityById(userId, activityId);
      if (!row) {
        throw new ActivityNotFoundError();
      }
      return hydrateFromStrava(userId, row);
    },
    async updateActivity(userId, activityId, input) {
      const row = await options.repo.getActivityById(userId, activityId);
      if (!row) {
        throw new ActivityNotFoundError();
      }
      const fields: {
        description?: string | null;
        title?: string;
        titleOverridden?: boolean;
        visibility?: ActivityVisibility;
      } = {};
      if ('description' in input) {
        fields.description = normalizeOwnerDescription(input.description ?? null);
      }
      if (
        input.visibility &&
        (activityVisibilities as readonly string[]).includes(input.visibility)
      ) {
        fields.visibility = input.visibility;
      }
      if ('title' in input) {
        const trimmed = input.title?.trim() ?? '';
        const providerTitle = providerTitleFromPayload(row.payload);
        if (trimmed.length === 0 || trimmed === providerTitle) {
          fields.title = providerTitle;
          fields.titleOverridden = false;
        } else {
          fields.title = trimmed;
          fields.titleOverridden = true;
        }
      }
      if (Object.keys(fields).length === 0) {
        return toActivityDetail(row);
      }
      const updated = await options.repo.updateActivityFields(userId, activityId, fields);
      if (!updated) {
        throw new ActivityNotFoundError();
      }
      if ('description' in input && options.strava) {
        const integration = await options.repo.getById(userId, updated.integrationId);
        if (integration && hasStravaActivityWrite(integration.scopes)) {
          const accessToken = await validAccessToken(integration);
          await options.strava.updateActivity(accessToken, updated.externalId, {
            description: fields.description ?? '',
          });
        }
      }
      return toActivityDetail(updated);
    },
    async listProjects(userId) {
      const units = await options.repo.getUserUnits(userId);
      const activities = await options.repo.listActivities(userId);
      const projects = await options.repo.listProjects(userId);
      return projects.map((project) => {
        const detail = projectView(project, activities, units);
        return {
          id: detail.id,
          name: detail.name,
          sport: detail.sport,
          totalDistanceM: detail.totalDistanceM,
          note: detail.note,
        };
      });
    },
    async getProject(userId, projectId) {
      return toPublicProject(userId, projectId);
    },
    async createProject(userId, input) {
      const name = input.name.trim();
      if (!name || !(sports as readonly string[]).includes(input.sport)) {
        throw new ActivityNotFoundError();
      }
      const project = await options.repo.createProject(userId, { name, sport: input.sport });
      await applyProjectNotes(userId);
      return toPublicProject(userId, project.id);
    },
    readStravaWebhookChallenge(query) {
      if (query.mode !== 'subscribe' || !query.challenge) {
        return null;
      }
      if (query.verifyToken !== webhookVerifyToken) {
        return null;
      }
      return { challenge: query.challenge };
    },
    async acceptStravaWebhook(event) {
      if (event.objectType !== 'activity' || event.aspectType !== 'create') {
        return;
      }
      if (!event.objectId || !event.ownerId || !options.strava) {
        return;
      }
      const integration = await options.repo.getIntegrationByExternalUserId(String(event.ownerId));
      if (!integration) {
        return;
      }
      await fetchStravaActivityById(integration.userId, integration, String(event.objectId));
      await applyProjectNotes(integration.userId);
    },
    async ensureStravaWebhook() {
      const callbackUrl = webhookCallbackUrl.trim();
      if (!options.strava || !callbackUrl || !options.secrets.stravaClientId) {
        return;
      }
      await options.strava.createWebhookSubscription(callbackUrl, webhookVerifyToken);
    },
  };
}

export function createUnavailableIntegrationService(): IntegrationService {
  const fail = async () => {
    throw Object.assign(new Error('Service unavailable'), { statusCode: 503 });
  };
  return {
    listIntegrations: fail,
    createConnectUrl: fail,
    handleCallback: async () => ({ location: '/' }),
    resync: fail,
    listActivities: fail,
    getActivity: fail,
    resyncActivity: fail,
    updateActivity: fail,
    listProjects: fail,
    getProject: fail,
    createProject: fail,
    readStravaWebhookChallenge: () => null,
    acceptStravaWebhook: fail,
    ensureStravaWebhook: async () => undefined,
  };
}
