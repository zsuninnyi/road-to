import { describe, expect, it } from 'vitest';
import { activityVisibilities, formatBrandTitle, healthSampleKinds, providers } from './index.js';

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

describe('formatBrandTitle', () => {
  it('is the brand alone when no project is selected', () => {
    expect(formatBrandTitle('RoadTo')).toBe('RoadTo');
    expect(formatBrandTitle('RoadTo', '  ')).toBe('RoadTo');
  });

  it('appends the project name in the header', () => {
    expect(formatBrandTitle('RoadTo', 'Marathon')).toBe('RoadTo Marathon');
    expect(formatBrandTitle('RoadTo', '  road to Marathon  ')).toBe('RoadTo road to Marathon');
  });
});
