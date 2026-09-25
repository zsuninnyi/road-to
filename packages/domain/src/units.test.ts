import { describe, expect, it } from 'vitest';
import {
  formatCalories,
  formatDistanceMeters,
  formatDurationSeconds,
  formatSpeedMps,
} from './units.js';

describe('formatDistanceMeters', () => {
  it('uses km and miles for typical run distances', () => {
    expect(formatDistanceMeters(10200, 'metric')).toBe('10.2 km');
    expect(formatDistanceMeters(1609.344, 'imperial')).toBe('1.00 mi');
  });
});

describe('formatSpeedMps', () => {
  it('uses km/h and mph', () => {
    expect(formatSpeedMps(2.7778, 'metric')).toBe('10.0 km/h');
    expect(formatSpeedMps(4.4704, 'imperial')).toBe('10.0 mph');
  });
});

describe('formatCalories', () => {
  it('rounds to whole kilocalories', () => {
    expect(formatCalories(512.4)).toBe('512 kcal');
  });
});

describe('formatDurationSeconds', () => {
  it('formats minutes and hours', () => {
    expect(formatDurationSeconds(72)).toBe('1:12');
    expect(formatDurationSeconds(3661)).toBe('1:01:01');
  });
});
