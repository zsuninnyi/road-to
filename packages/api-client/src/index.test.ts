import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('createApiClient', () => {
  it('strips a trailing slash from the base URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: 'http://example.test/api/', fetch: fetchFn });

    await client.health();

    expect(fetchFn).toHaveBeenCalledWith('http://example.test/api/health', {
      credentials: 'include',
    });
  });

  it('returns health payloads', async () => {
    const client = createApiClient({
      baseUrl: 'http://example.test',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ ok: true })),
    });

    await expect(client.health()).resolves.toEqual({ ok: true });
  });

  it('throws ApiError when the response is not ok', async () => {
    const client = createApiClient({
      baseUrl: 'http://example.test',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 503)),
    });

    await expect(client.health()).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    });
    await expect(client.health()).rejects.toBeInstanceOf(ApiError);
  });

  it('returns the current user from /v1/me', async () => {
    const user = {
      id: 'user_1',
      name: 'Viktor',
      email: 'viktor@example.test',
      image: null,
      units: 'metric' as const,
    };
    const client = createApiClient({
      baseUrl: 'http://example.test',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ user })),
    });

    await expect(client.me()).resolves.toEqual({ user });
  });

  it('lists integrations and activities', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ integrations: [] }))
      .mockResolvedValueOnce(jsonResponse({ activities: [] }));
    const client = createApiClient({ baseUrl: 'http://example.test', fetch: fetchFn });

    await expect(client.integrations()).resolves.toEqual({ integrations: [] });
    await expect(client.activities()).resolves.toEqual({ activities: [] });
    expect(fetchFn).toHaveBeenCalledWith('http://example.test/v1/integrations', {
      credentials: 'include',
    });
  });

  it('loads one activity', async () => {
    const detail = {
      id: 'act_1',
      sport: 'run',
      title: 'Morning Run',
      startedAt: '2026-09-20T06:00:00.000Z',
      endedAt: '2026-09-20T07:00:00.000Z',
      distanceM: 10200,
      movingTimeS: 3500,
      elapsedTimeS: 3600,
      elevationGainM: 80,
      avgHr: 148,
      mapPolyline: null,
      sources: [{ provider: 'strava' as const }],
      timezone: null,
      maxHr: 171,
      avgSpeedMps: 2.91,
      calories: 640,
      hydrated: true,
      streams: null,
    };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(detail));
    const client = createApiClient({ baseUrl: 'http://example.test', fetch: fetchFn });
    await expect(client.activity('act_1')).resolves.toEqual(detail);
    expect(fetchFn).toHaveBeenCalledWith('http://example.test/v1/activities/act_1', {
      credentials: 'include',
    });
  });

  it('posts Strava connect', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ url: 'https://www.strava.com/oauth/authorize' }));
    const client = createApiClient({ baseUrl: 'http://example.test', fetch: fetchFn });

    await expect(client.connectStrava()).resolves.toEqual({
      url: 'https://www.strava.com/oauth/authorize',
    });
    expect(fetchFn).toHaveBeenCalledWith('http://example.test/v1/integrations/strava/connect', {
      credentials: 'include',
      method: 'POST',
    });
  });
});
