import { fromNodeHeaders } from 'better-auth/node';
import Fastify from 'fastify';
import { createNullAuth, type AuthLike, type AuthUser } from './auth.js';
import { registerAuthRoutes } from './auth-routes.js';

export type AppOptions = {
  logger?: boolean;
  auth?: AuthLike;
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

  await registerAuthRoutes(app, auth);

  const health = async () => ({ ok: true as const });
  app.get('/health', health);

  app.get('/v1/me', async (request, reply) => {
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
