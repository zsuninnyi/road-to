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

function createFakeStrava(activities: unknown[] = [sampleActivity]): StravaClient {
  return {
    exchangeCode: async (code) => {
      if (code !== 'ok-code') {
        throw new Error('bad code');
      }
      return {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date('2026-09-23T18:00:00Z'),
        athleteId: '42',
      };
    },
    refreshAccessToken: async () => {
      throw new Error('refresh not used');
    },
    listActivities: async () => activities,
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
