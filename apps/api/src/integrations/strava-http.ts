export type StravaTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  athleteId: string;
  scope?: string;
};

export type StravaClient = {
  exchangeCode(code: string): Promise<StravaTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<StravaTokenSet>;
  listActivities(
    accessToken: string,
    params: { afterUnix: number; page: number; perPage: number },
  ): Promise<unknown[]>;
};

export class StravaHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'StravaHttpError';
    this.status = status;
  }
}

type TokenJson = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { id?: number };
};

function parseToken(payload: TokenJson, requireAthlete: boolean): StravaTokenSet {
  if (!payload.access_token || !payload.refresh_token || !payload.expires_at) {
    throw new StravaHttpError(502, 'Unexpected Strava token response');
  }
  if (requireAthlete && !payload.athlete?.id) {
    throw new StravaHttpError(502, 'Unexpected Strava token response');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(payload.expires_at * 1000),
    athleteId: payload.athlete?.id ? String(payload.athlete.id) : '',
  };
}

export function createStravaHttpClient(options: {
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
}): StravaClient {
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  async function tokenRequest(
    body: Record<string, string>,
    requireAthlete: boolean,
  ): Promise<StravaTokenSet> {
    const response = await fetchFn('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        ...body,
      }),
    });
    const json = (await response.json()) as TokenJson;
    if (!response.ok) {
      throw new StravaHttpError(response.status, 'Strava token request failed');
    }
    return parseToken(json, requireAthlete);
  }

  return {
    exchangeCode(code) {
      return tokenRequest({ code, grant_type: 'authorization_code' }, true);
    },
    refreshAccessToken(refreshToken) {
      return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' }, false);
    },
    async listActivities(accessToken, params) {
      const url = new URL('https://www.strava.com/api/v3/athlete/activities');
      url.searchParams.set('after', String(params.afterUnix));
      url.searchParams.set('page', String(params.page));
      url.searchParams.set('per_page', String(params.perPage));
      const response = await fetchFn(url, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new StravaHttpError(response.status, 'Strava activity list failed');
      }
      const json: unknown = await response.json();
      return Array.isArray(json) ? json : [];
    },
  };
}
