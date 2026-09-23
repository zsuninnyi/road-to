import { describe, expect, it } from 'vitest';
import { mapStravaSport, sports } from './sports.js';

describe('mapStravaSport', () => {
  it('maps common Strava sport_type values', () => {
    expect(mapStravaSport('Run')).toBe('run');
    expect(mapStravaSport('TrailRun')).toBe('run');
    expect(mapStravaSport('Ride')).toBe('ride');
    expect(mapStravaSport('Swim')).toBe('swim');
    expect(mapStravaSport('WeightTraining')).toBe('strength');
  });

  it('falls back to type, then other', () => {
    expect(mapStravaSport(null, 'Run')).toBe('run');
    expect(mapStravaSport('UnknownSport')).toBe('other');
    expect(sports).toContain('other');
  });
});
