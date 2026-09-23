import { fromNodeHeaders } from 'better-auth/node';
import type { Kysely } from 'kysely';
import Fastify from 'fastify';
import { createNullAuth, type AuthLike, type AuthUser } from './auth.js';
import { registerAuthRoutes } from './auth-routes.js';
import type { Database } from './db/types.js';
import { createConfiguredIntegrationService } from './integrations/factory.js';
import { registerIntegrationRoutes } from './integrations/routes.js';
import {
  createUnavailableIntegrationService,
  type IntegrationService,
} from './integrations/service.js';
import { healthRouteSchema, meRouteSchema, registerSwagger } from './swagger.js';

export type AppOptions = {
  logger?: boolean;
  auth?: AuthLike;
  db?: Kysely<Database>;
  integrations?: IntegrationService;
};

function toPublicUser(user: AuthUser) {
  const units = user.units === 'imperial' ? 'imperial' : 'metric';
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    units,
  };
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  });
  const auth = options.auth ?? createNullAuth();
  const integrations =
    options.integrations ??
    (options.db
      ? createConfiguredIntegrationService(options.db)
      : createUnavailableIntegrationService());

  await registerSwagger(app);
  await registerAuthRoutes(app, auth);
  await registerIntegrationRoutes(app, { auth, integrations });

  const health = async () => ({ ok: true as const });
  app.get('/health', { schema: healthRouteSchema }, health);

  app.get('/v1/me', { schema: meRouteSchema }, async (request, reply) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      return { user: toPublicUser(session.user) };
    } catch (error) {
      request.log.error(error);
      return reply.status(503).send({ error: 'Service unavailable' });
    }
  });

  return app;
}
