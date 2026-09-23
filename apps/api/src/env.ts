import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadRootEnv(): void {
  const envPath = path.join(repoRoot, '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgres://roadto:roadto@127.0.0.1:5432/roadto';
}

export function getAuthSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? 'dev-only-not-secret-change-me-32ch';
}

export function getAuthBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://127.0.0.1:5173';
}

export function getTrustedOrigins(): string[] {
  const defaults = ['http://127.0.0.1:5173', 'http://localhost:5173'];
  const fromEnv = process.env.WEB_ORIGIN;
  if (!fromEnv) {
    return defaults;
  }
  return [...new Set([fromEnv, ...defaults])];
}

export function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  };
}

export function getStravaCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
  };
}

export function getStravaRedirectUri(): string {
  return (
    process.env.STRAVA_REDIRECT_URI ?? `${getAuthBaseUrl()}/api/v1/integrations/strava/callback`
  );
}

export function getTokenEncryptionKeySource(): string | undefined {
  return process.env.TOKEN_ENCRYPTION_KEY;
}
