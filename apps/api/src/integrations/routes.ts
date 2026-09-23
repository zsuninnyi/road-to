import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthLike } from '../auth.js';
import { requireUser } from '../session.js';
import { errorSchema } from '../swagger.js';
import {
  IntegrationNotFoundError,
  StravaNotConfiguredError,
  type IntegrationService,
} from './service.js';

const sessionSecurity = [{ sessionCookie: [] }];

const integrationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'provider', 'status', 'externalUserId', 'lastSyncAt'],
  properties: {
    id: { type: 'string' },
    provider: { type: 'string', enum: ['strava'] },
    status: { type: 'string', enum: ['active', 'expired', 'error', 'revoked'] },
    externalUserId: { type: 'string' },
    lastSyncAt: { type: ['string', 'null'] },
  },
} as const;

const activitySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'sport',
    'title',
    'startedAt',
    'endedAt',
    'distanceM',
    'movingTimeS',
    'elapsedTimeS',
    'elevationGainM',
    'avgHr',
    'mapPolyline',
    'sources',
  ],
  properties: {
    id: { type: 'string' },
    sport: { type: 'string' },
    title: { type: 'string' },
    startedAt: { type: 'string' },
    endedAt: { type: 'string' },
    distanceM: { type: ['number', 'null'] },
    movingTimeS: { type: ['integer', 'null'] },
    elapsedTimeS: { type: ['integer', 'null'] },
    elevationGainM: { type: ['number', 'null'] },
    avgHr: { type: ['integer', 'null'] },
    mapPolyline: { type: ['string', 'null'] },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['provider'],
        properties: { provider: { type: 'string', enum: ['strava'] } },
      },
    },
  },
} as const;

async function sendServiceError(reply: FastifyReply, error: unknown): Promise<unknown> {
  if (error instanceof StravaNotConfiguredError) {
    return reply.status(503).send({ error: 'Strava is not configured' });
  }
  if (error instanceof IntegrationNotFoundError) {
    return reply.status(404).send({ error: 'Not found' });
  }
  return reply.status(503).send({ error: 'Service unavailable' });
}

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  options: { auth: AuthLike; integrations: IntegrationService },
): Promise<void> {
  const { auth, integrations } = options;

  app.get(
    '/v1/integrations',
    {
      schema: {
        tags: ['integrations'],
        summary: 'Connected training accounts',
        security: sessionSecurity,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['integrations'],
            properties: { integrations: { type: 'array', items: integrationSchema } },
          },
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireUser(auth, request, reply);
      if (!user) {
        return;
      }
      try {
        return { integrations: await integrations.listIntegrations(user.id) };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post(
    '/v1/integrations/strava/connect',
    {
      schema: {
        tags: ['integrations'],
        summary: 'Start Strava OAuth',
        security: sessionSecurity,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['url'],
            properties: { url: { type: 'string' } },
          },
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireUser(auth, request, reply);
      if (!user) {
        return;
      }
      try {
        return await integrations.createConnectUrl(user.id);
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.get(
    '/v1/integrations/strava/callback',
    {
      schema: {
        tags: ['integrations'],
        summary: 'Strava OAuth callback',
        description:
          'Browser lands here after Strava. Exchanges the code, imports the last 30 days, redirects to `/app`.',
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            scope: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };
      let userId: string | null = null;
      try {
        const session = await options.auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        userId = session?.user.id ?? null;
      } catch (error) {
        request.log.error(error);
      }
      const result = await integrations.handleCallback({
        userId,
        code: query.code,
        state: query.state,
        error: query.error,
      });
      return reply.redirect(result.location);
    },
  );

  app.post(
    '/v1/integrations/:id/resync',
    {
      schema: {
        tags: ['integrations'],
        summary: 'Re-import the last 30 days from this integration',
        security: sessionSecurity,
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['imported'],
            properties: { imported: { type: 'integer' } },
          },
          401: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireUser(auth, request, reply);
      if (!user) {
        return;
      }
      const { id } = request.params as { id: string };
      try {
        return await integrations.resync(user.id, id);
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.get(
    '/v1/activities',
    {
      schema: {
        tags: ['activities'],
        summary: 'Canonical activity list',
        security: sessionSecurity,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['activities'],
            properties: { activities: { type: 'array', items: activitySchema } },
          },
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireUser(auth, request, reply);
      if (!user) {
        return;
      }
      try {
        return { activities: await integrations.listActivities(user.id) };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
