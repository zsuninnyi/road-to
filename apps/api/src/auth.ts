import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import { getAuthBaseUrl, getAuthSecret, getGoogleCredentials, getTrustedOrigins } from './env.js';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  units?: string | null;
};

export type AuthSession = {
  user: AuthUser;
  session: {
    id: string;
    token: string;
  };
};

export type AuthLike = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (args: { headers: Headers }) => Promise<AuthSession | null>;
  };
};

export function createNullAuth(): AuthLike {
  return {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () => null,
    },
  };
}

export function createAuth(pool: Pool): AuthLike {
  const google = getGoogleCredentials();

  return betterAuth({
    secret: getAuthSecret(),
    baseURL: getAuthBaseUrl(),
    basePath: '/api/auth',
    trustedOrigins: getTrustedOrigins(),
    database: pool,
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        prompt: 'select_account',
      },
    },
    user: {
      additionalFields: {
        units: {
          type: ['metric', 'imperial'],
          required: false,
          defaultValue: 'metric',
          input: false,
        },
      },
    },
    telemetry: {
      enabled: false,
    },
  });
}
