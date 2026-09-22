import { describe, expect, it } from 'vitest';
import { activityVisibilities, healthSampleKinds, providers } from './index.js';

describe('domain catalogs', () => {
  it('includes the four activity providers', () => {
    expect([...providers]).toEqual(['strava', 'garmin', 'whoop', 'trainingpeaks']);
  });

  it('treats sleep as a health metric, not a provider', () => {
    expect(healthSampleKinds).toContain('sleep');
    expect((providers as readonly string[]).includes('sleep')).toBe(false);
  });

  it('defaults visibility options to private and public', () => {
    expect([...activityVisibilities]).toEqual(['private', 'public']);
  });
});
