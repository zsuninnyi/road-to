import { describe, expect, it } from 'vitest';
import {
  activityFingerprint,
  normalizeStravaSummary,
  parseStravaSummary,
  stravaBackfillAfterUnix,
  stravaInitialBackfillDays,
} from './strava.js';

const sample = {
  id: 98_765,
  name: 'Morning Run',
  sport_type: 'Run',
  start_date: '2026-09-20T06:00:00Z',
  elapsed_time: 3600,
  moving_time: 3500,
  distance: 10200,
  total_elevation_gain: 80,
  average_heartrate: 148,
  max_heartrate: 171,
  average_speed: 2.91,
  timezone: '(GMT+02:00) Europe/Budapest',
  map: { summary_polyline: '_p~iF~ps|U' },
};

describe('normalizeStravaSummary', () => {
  it('maps a summary activity to canonical fields', () => {
    const parsed = parseStravaSummary(sample);
    expect(parsed).not.toBeNull();
    const normalized = normalizeStravaSummary(parsed!);
    expect(normalized).toMatchObject({
      provider: 'strava',
      externalId: '98765',
      sport: 'run',
      title: 'Morning Run',
      startedAt: '2026-09-20T06:00:00.000Z',
      endedAt: '2026-09-20T07:00:00.000Z',
      distanceM: 10200,
      movingTimeS: 3500,
      mapPolyline: '_p~iF~ps|U',
      hasGps: true,
    });
  });

  it('skips rows without a usable start time', () => {
    expect(parseStravaSummary({ name: 'x' })).toBeNull();
    expect(normalizeStravaSummary({ id: 1, start_date: 'not-a-date' })).toBeNull();
  });
});

describe('strava backfill window', () => {
  it('is 30 days', () => {
    expect(stravaInitialBackfillDays).toBe(30);
    expect(stravaBackfillAfterUnix(Date.UTC(2026, 8, 23))).toBe(
      Math.floor(Date.UTC(2026, 7, 24) / 1000),
    );
  });
});

describe('activityFingerprint', () => {
  it('is stable for the same start, sport, and distance', () => {
    expect(
      activityFingerprint({
        startedAt: '2026-09-20T06:00:00.000Z',
        sport: 'run',
        distanceM: 10200.4,
      }),
    ).toBe('2026-09-20T06:00:00.000Z|run|10200');
  });
});
