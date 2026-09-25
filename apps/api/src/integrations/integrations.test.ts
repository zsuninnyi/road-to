import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { AuthLike, AuthSession } from '../auth.js';
import { tokenKeyFromSecret } from '../crypto/tokens.js';
import { createMemoryIntegrationRepository } from './memory-repository.js';
import { createOAuthState } from './oauth-state.js';
import { createIntegrationService } from './service.js';
import type { StravaClient } from './strava-http.js';

function createTestAuth(session: AuthSession | null): AuthLike {
  return {
    handler: async () => new Response(null, { status: 404 }),
    api: { getSession: async () => session },
  };
}

const signedIn: AuthSession = {
  user: {
    id: 'user_1',
    name: 'Viktor',
    email: 'viktor@example.test',
    image: null,
    units: 'metric',
  },
  session: { id: 'session_1', token: 'token_1' },
};

const sampleActivity = {
  id: 98_765,
  name: 'Morning Run',
  sport_type: 'Run',
  start_date: '2026-09-20T06:00:00Z',
  elapsed_time: 3600,
  moving_time: 3500,
  distance: 10200,
  map: { summary_polyline: '_p~iF~ps|U' },
};

function createFakeStrava(
  activities: unknown[] = [sampleActivity],
  options: {
    expiresAt?: Date;
    refresh?: () => Promise<{
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      athleteId: string;
    }>;
    onGetActivity?: () => void;
    onGetStreams?: () => void;
  } = {},
): StravaClient {
  return {
    exchangeCode: async (code) => {
      if (code !== 'ok-code') {
        throw new Error('bad code');
      }
      return {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: options.expiresAt ?? new Date('2026-09-23T18:00:00Z'),
        athleteId: '42',
      };
    },
    refreshAccessToken: async () => {
      if (!options.refresh) {
        throw new Error('refresh not used');
      }
      return options.refresh();
    },
    listActivities: async () => activities,
    getActivity: async (_token, id) => {
      options.onGetActivity?.();
      return {
        ...sampleActivity,
        id: Number(id),
        calories: 640,
        average_heartrate: 148,
        max_heartrate: 171,
        average_speed: 2.91,
        total_elevation_gain: 80,
        map: { summary_polyline: '_p~iF~ps|U', polyline: '_p~iF~ps|U' },
      };
    },
    getStreams: async () => {
      options.onGetStreams?.();
      return {
        latlng: {
          data: [
            [47.5, 19.04],
            [47.51, 19.05],
          ],
        },
        time: { data: [0, 10] },
        altitude: { data: [110, 112] },
        heartrate: { data: [140, 145] },
      };
    },
  };
}

const secrets = {
  tokenKey: tokenKeyFromSecret('test-secret'),
  oauthSecret: 'test-secret',
  stravaClientId: 'strava-client',
  stravaClientSecret: 'strava-secret',
  redirectUri: 'http://127.0.0.1:5173/api/v1/integrations/strava/callback',
  webOrigin: 'http://127.0.0.1:5173',
};

describe('Strava integrations', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function build(
    session: AuthSession | null = signedIn,
    strava: StravaClient | null = createFakeStrava(),
  ) {
    const integrations = createIntegrationService({
      repo: createMemoryIntegrationRepository(),
      strava,
      secrets,
      now: () => new Date('2026-09-23T12:00:00Z'),
    });
    app = await buildApp({
      logger: false,
      auth: createTestAuth(session),
      integrations,
    });
    return app;
  }

  it('rejects unauthenticated list calls', async () => {
    const server = await build(null);
    const response = await server.inject({ method: 'GET', url: '/v1/activities' });
    expect(response.statusCode).toBe(401);
  });

  it('returns a Strava authorize URL', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/integrations/strava/connect',
    });
    expect(response.statusCode).toBe(200);
    const url = new URL((response.json() as { url: string }).url);
    expect(url.origin).toBe('https://www.strava.com');
    expect(url.searchParams.get('client_id')).toBe('strava-client');
    expect(url.searchParams.get('redirect_uri')).toBe(secrets.redirectUri);
    expect(url.searchParams.get('scope')).toBe('read,activity:read_all');
  });

  it('imports the last month after the OAuth callback', async () => {
    const server = await build();
    const state = createOAuthState(
      'user_1',
      secrets.oauthSecret,
      Date.parse('2026-09-23T12:00:00Z'),
    );
    const callback = await server.inject({
      method: 'GET',
      url: `/v1/integrations/strava/callback?code=ok-code&state=${encodeURIComponent(state)}`,
    });

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('http://127.0.0.1:5173/app?strava=connected');

    const list = await server.inject({ method: 'GET', url: '/v1/activities' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      activities: [
        {
          id: expect.any(String),
          sport: 'run',
          title: 'Morning Run',
          startedAt: '2026-09-20T06:00:00.000Z',
          endedAt: '2026-09-20T07:00:00.000Z',
          distanceM: 10200,
          movingTimeS: 3500,
          elapsedTimeS: 3600,
          elevationGainM: null,
          avgHr: null,
          mapPolyline: '_p~iF~ps|U',
          sources: [{ provider: 'strava' }],
        },
      ],
    });

    const integrations = await server.inject({ method: 'GET', url: '/v1/integrations' });
    expect(integrations.json()).toEqual({
      integrations: [
        {
          id: expect.any(String),
          provider: 'strava',
          status: 'active',
          externalUserId: '42',
          lastSyncAt: '2026-09-23T12:00:00.000Z',
        },
      ],
    });
  });

  it('resyncs the last month', async () => {
    const server = await build();
    const state = createOAuthState(
      'user_1',
      secrets.oauthSecret,
      Date.parse('2026-09-23T12:00:00Z'),
    );
    await server.inject({
      method: 'GET',
      url: `/v1/integrations/strava/callback?code=ok-code&state=${encodeURIComponent(state)}`,
    });

    const listed = await server.inject({ method: 'GET', url: '/v1/integrations' });
    const id = (listed.json() as { integrations: { id: string }[] }).integrations[0]?.id;
    const resync = await server.inject({ method: 'POST', url: `/v1/integrations/${id}/resync` });

    expect(resync.statusCode).toBe(200);
    expect(resync.json()).toEqual({ imported: 1 });
  });

  it('refreshes an expired access token before import', async () => {
    let refreshed = false;
    const server = await build(
      signedIn,
      createFakeStrava([sampleActivity], {
        expiresAt: new Date('2026-09-23T11:00:00Z'),
        refresh: async () => {
          refreshed = true;
          return {
            accessToken: 'access-2',
            refreshToken: 'refresh-2',
            expiresAt: new Date('2026-09-24T12:00:00Z'),
            athleteId: '',
          };
        },
      }),
    );
    const state = createOAuthState(
      'user_1',
      secrets.oauthSecret,
      Date.parse('2026-09-23T12:00:00Z'),
    );
    const callback = await server.inject({
      method: 'GET',
      url: `/v1/integrations/strava/callback?code=ok-code&state=${encodeURIComponent(state)}`,
    });

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('http://127.0.0.1:5173/app?strava=connected');
    expect(refreshed).toBe(true);
  });

  it('hydrates activity detail from Strava once and then reads the database', async () => {
    let activityCalls = 0;
    let streamCalls = 0;
    const server = await build(
      signedIn,
      createFakeStrava([sampleActivity], {
        onGetActivity: () => {
          activityCalls += 1;
        },
        onGetStreams: () => {
          streamCalls += 1;
        },
      }),
    );
    const state = createOAuthState(
      'user_1',
      secrets.oauthSecret,
      Date.parse('2026-09-23T12:00:00Z'),
    );
    await server.inject({
      method: 'GET',
      url: `/v1/integrations/strava/callback?code=ok-code&state=${encodeURIComponent(state)}`,
    });

    const listed = await server.inject({ method: 'GET', url: '/v1/activities' });
    const id = (listed.json() as { activities: { id: string }[] }).activities[0]?.id;
    expect(id).toBeDefined();

    const first = await server.inject({ method: 'GET', url: `/v1/activities/${id}` });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      id,
      title: 'Morning Run',
      calories: 640,
      maxHr: 171,
      hydrated: true,
      streams: {
        latlng: [
          [47.5, 19.04],
          [47.51, 19.05],
        ],
        timeS: [0, 10],
        altitudeM: [110, 112],
        heartrate: [140, 145],
      },
    });
    expect(activityCalls).toBe(1);
    expect(streamCalls).toBe(1);

    const second = await server.inject({ method: 'GET', url: `/v1/activities/${id}` });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ hydrated: true, calories: 640 });
    expect(activityCalls).toBe(1);
    expect(streamCalls).toBe(1);

    const integrations = await server.inject({ method: 'GET', url: '/v1/integrations' });
    const integrationId = (integrations.json() as { integrations: { id: string }[] })
      .integrations[0]?.id;
    await server.inject({ method: 'POST', url: `/v1/integrations/${integrationId}/resync` });
    await server.inject({ method: 'GET', url: `/v1/activities/${id}` });
    expect(activityCalls).toBe(1);
    expect(streamCalls).toBe(1);
  });

  it('returns 404 for an unknown activity', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/activities/missing',
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 503 when Strava credentials are missing', async () => {
    const integrations = createIntegrationService({
      repo: createMemoryIntegrationRepository(),
      strava: null,
      secrets: { ...secrets, stravaClientId: '' },
    });
    app = await buildApp({
      logger: false,
      auth: createTestAuth(signedIn),
      integrations,
    });
    const response = await app.inject({ method: 'POST', url: '/v1/integrations/strava/connect' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'Strava is not configured' });
  });
});
