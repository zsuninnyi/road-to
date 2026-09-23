import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { AuthLike, AuthSession } from './auth.js';

function createTestAuth(session: AuthSession | null = null): AuthLike {
  return {
    handler: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/auth/ok') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'better-auth.session_token=test; Path=/; HttpOnly; SameSite=Lax',
          },
        });
      }
      return new Response(null, { status: 404 });
    },
    api: {
      getSession: async () => session,
    },
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
  session: {
    id: 'session_1',
    token: 'token_1',
  },
};

describe('API', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /health returns ok', async () => {
    app = await buildApp({ logger: false, auth: createTestAuth() });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('GET /v1/me is unauthorized without a session', async () => {
    app = await buildApp({ logger: false, auth: createTestAuth() });
    const response = await app.inject({ method: 'GET', url: '/v1/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('GET /v1/me returns 503 when the session store is down', async () => {
    app = await buildApp({
      logger: false,
      auth: {
        handler: async () => new Response(null, { status: 404 }),
        api: {
          getSession: async () => {
            throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
              code: 'ECONNREFUSED',
            });
          },
        },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'Service unavailable' });
  });

  it('GET /v1/me returns the current user when a session exists', async () => {
    app = await buildApp({ logger: false, auth: createTestAuth(signedIn) });
    const response = await app.inject({ method: 'GET', url: '/v1/me' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: 'user_1',
        name: 'Viktor',
        email: 'viktor@example.test',
        image: null,
        units: 'metric',
      },
    });
  });

  it('forwards Better Auth responses including session cookies', async () => {
    app = await buildApp({ logger: false, auth: createTestAuth() });
    const response = await app.inject({ method: 'GET', url: '/api/auth/ok' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('better-auth.session_token=test')]),
    );
  });

  it('matches nested Better Auth paths', async () => {
    app = await buildApp({
      logger: false,
      auth: {
        handler: async (request) =>
          new Response(JSON.stringify({ path: new URL(request.url).pathname }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        api: { getSession: async () => null },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/auth/callback/google' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: '/api/auth/callback/google' });
  });
});
