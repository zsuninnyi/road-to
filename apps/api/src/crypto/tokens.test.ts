import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, tokenKeyFromSecret } from './tokens.js';

describe('token encryption', () => {
  it('round-trips a Strava refresh token', () => {
    const key = tokenKeyFromSecret('test-secret');
    const payload = encryptSecret('strava-refresh-token', key);
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('strava-refresh-token');
    expect(decryptSecret(payload, key)).toBe('strava-refresh-token');
  });
});
