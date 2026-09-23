import type { Kysely } from 'kysely';
import { parseTokenKey } from '../crypto/tokens.js';
import type { Database } from '../db/types.js';
import {
  getAuthBaseUrl,
  getAuthSecret,
  getStravaCredentials,
  getStravaRedirectUri,
  getTokenEncryptionKeySource,
} from '../env.js';
import { createKyselyIntegrationRepository } from './kysely-repository.js';
import { createIntegrationService, type IntegrationService } from './service.js';
import { createStravaHttpClient } from './strava-http.js';

export function createConfiguredIntegrationService(db: Kysely<Database>): IntegrationService {
  const strava = getStravaCredentials();
  const configured = strava.clientId.length > 0 && strava.clientSecret.length > 0;
  return createIntegrationService({
    repo: createKyselyIntegrationRepository(db),
    strava: configured ? createStravaHttpClient(strava) : null,
    secrets: {
      tokenKey: parseTokenKey(getTokenEncryptionKeySource(), getAuthSecret()),
      oauthSecret: getAuthSecret(),
      stravaClientId: strava.clientId,
      stravaClientSecret: strava.clientSecret,
      redirectUri: getStravaRedirectUri(),
      webOrigin: getAuthBaseUrl(),
    },
  });
}
