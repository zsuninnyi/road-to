import { describe, expect, it } from 'vitest';
import { formatDistanceMeters, formatDurationSeconds } from './units.js';

describe('formatDistanceMeters', () => {
  it('uses km and miles for typical run distances', () => {
    expect(formatDistanceMeters(10200, 'metric')).toBe('10.2 km');
    expect(formatDistanceMeters(1609.344, 'imperial')).toBe('1.00 mi');
  });
});

describe('formatDurationSeconds', () => {
  it('formats minutes and hours', () => {
    expect(formatDurationSeconds(72)).toBe('1:12');
    expect(formatDurationSeconds(3661)).toBe('1:01:01');
  });
});
