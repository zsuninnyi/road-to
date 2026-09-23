import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export const swaggerRoutePrefix = '/docs';

export const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
};

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', const: true },
  },
};

export const meResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user'],
  properties: {
    user: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'email', 'image', 'units'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        image: { type: ['string', 'null'] },
        units: { type: 'string', enum: ['metric', 'imperial'] },
      },
    },
  },
};

export const healthRouteSchema = {
  tags: ['ops'],
  summary: 'Liveness check',
  response: {
    200: healthResponseSchema,
  },
};

export const meRouteSchema = {
  tags: ['session'],
  summary: 'Current user',
  description: 'Reads the Better Auth session cookie. Used by the SPA to gate `/app`.',
  security: [{ sessionCookie: [] }],
  response: {
    200: meResponseSchema,
    401: errorSchema,
    503: errorSchema,
  },
};

const betterAuthPaths = {
  '/api/auth/sign-in/social': {
    post: {
      tags: ['better-auth'],
      summary: 'Start Google sign-in',
      description:
        'Called by `authClient.signIn.social`. Body includes `provider: google` and `callbackURL` (e.g. `/app`).',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['provider'],
              properties: {
                provider: { type: 'string', enum: ['google'] },
                callbackURL: { type: 'string', example: '/app' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Redirect URL or redirect to Google' },
      },
    },
  },
  '/api/auth/callback/google': {
    get: {
      tags: ['better-auth'],
      summary: 'Google OAuth callback',
      description:
        'Browser lands here after Google. Sets the session cookie and redirects to `callbackURL`.',
      responses: {
        '302': { description: 'Redirect to the SPA with session cookie set' },
      },
    },
  },
  '/api/auth/sign-out': {
    post: {
      tags: ['better-auth'],
      summary: 'Sign out',
      security: [{ sessionCookie: [] }],
      responses: {
        '200': { description: 'Session deleted; cookie cleared' },
      },
    },
  },
  '/api/auth/get-session': {
    get: {
      tags: ['better-auth'],
      summary: 'Better Auth session',
      security: [{ sessionCookie: [] }],
      responses: {
        '200': { description: 'Session payload or null' },
      },
    },
  },
};

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'RoadTo API',
        version: '0.0.0',
        description:
          'Fastify API for RoadTo. Session cookie via Better Auth (`/api/auth/*`). Google OAuth callback is `{BETTER_AUTH_URL}/api/auth/callback/google`.',
      },
      tags: [
        { name: 'ops', description: 'Process health' },
        { name: 'session', description: 'Signed-in user' },
        { name: 'better-auth', description: 'Google OAuth and session cookie (Better Auth)' },
        { name: 'integrations', description: 'Connected training accounts (Strava first)' },
        { name: 'activities', description: 'Canonical activity library' },
      ],
      components: {
        securitySchemes: {
          sessionCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
          },
        },
      },
    },
    transformObject: (documentObject) => {
      if (!('openapiObject' in documentObject)) {
        return documentObject.swaggerObject;
      }

      const spec = documentObject.openapiObject;
      spec.paths = {
        ...spec.paths,
        ...betterAuthPaths,
      } as typeof spec.paths;
      return spec;
    },
  });

  await app.register(swaggerUi, {
    routePrefix: swaggerRoutePrefix,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
