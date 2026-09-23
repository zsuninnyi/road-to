import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthLike } from './auth.js';

function publicOrigin(request: FastifyRequest): string {
  const forwardedHost = request.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? request.headers.host;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? 'http';
  return `${proto}://${host ?? '127.0.0.1:3001'}`;
}

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthLike): Promise<void> {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request: FastifyRequest, reply: FastifyReply) {
      const url = new URL(request.url, publicOrigin(request));
      const headers = fromNodeHeaders(request.headers);
      const init: RequestInit = {
        method: request.method,
        headers,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body != null) {
        init.body = JSON.stringify(request.body);
      }

      const response = await auth.handler(new Request(url, init));
      reply.status(response.status);

      const cookies = response.headers.getSetCookie();
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          return;
        }
        void reply.header(key, value);
      });
      if (cookies.length > 0) {
        void reply.header('set-cookie', cookies);
      }

      const text = await response.text();
      return reply.send(text.length > 0 ? text : null);
    },
  });
}
