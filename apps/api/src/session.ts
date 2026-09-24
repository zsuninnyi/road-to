import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthLike, AuthUser } from './auth.js';

export async function requireUser(
  auth: AuthLike,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      await reply.status(401).send({ error: 'Unauthorized' });
      return null;
    }
    return session.user;
  } catch (error) {
    request.log.error(error);
    await reply.status(503).send({ error: 'Service unavailable' });
    return null;
  }
}
