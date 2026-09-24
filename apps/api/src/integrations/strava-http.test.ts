import { describe, expect, it } from 'vitest';
import { createStravaHttpClient, StravaHttpError } from './strava-http.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createStravaHttpClient', () => {
  it('parses authorization_code tokens including athlete id', async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 1_800_000_000,
        athlete: { id: 42 },
      });
    const client = createStravaHttpClient({
      clientId: 'id',
      clientSecret: 'secret',
      fetchFn,
    });
    await expect(client.exchangeCode('code')).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date(1_800_000_000 * 1000),
      athleteId: '42',
    });
  });

  it('parses refresh tokens that omit athlete', async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({
        token_type: 'Bearer',
        access_token: 'a2',
        refresh_token: 'r2',
        expires_at: 1_800_000_000,
        expires_in: 21600,
      });
    const client = createStravaHttpClient({
      clientId: 'id',
      clientSecret: 'secret',
      fetchFn,
    });
    await expect(client.refreshAccessToken('r')).resolves.toEqual({
      accessToken: 'a2',
      refreshToken: 'r2',
      expiresAt: new Date(1_800_000_000 * 1000),
      athleteId: '',
    });
  });

  it('rejects authorization_code tokens without athlete', async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 1_800_000_000,
      });
    const client = createStravaHttpClient({
      clientId: 'id',
      clientSecret: 'secret',
      fetchFn,
    });
    await expect(client.exchangeCode('code')).rejects.toBeInstanceOf(StravaHttpError);
  });
});
