import { describe, expect, it } from 'vitest';
import { activityMatchesProjectWindow, readProjectWindow } from './project-window.js';

describe('readProjectWindow', () => {
  it('accepts an inclusive range and blank bounds', () => {
    expect(readProjectWindow('2026-01-01', '2026-04-30')).toEqual({
      windowStart: '2026-01-01',
      windowEnd: '2026-04-30',
    });
    expect(readProjectWindow('', null)).toEqual({ windowStart: null, windowEnd: null });
    expect(readProjectWindow('2026-01-01', '')).toEqual({
      windowStart: '2026-01-01',
      windowEnd: null,
    });
  });

  it('rejects a reversed range and a calendar date that does not exist', () => {
    expect(readProjectWindow('2026-05-01', '2026-01-01')).toBeNull();
    expect(readProjectWindow('2026-02-31', '2026-03-01')).toBeNull();
  });
});

describe('activityMatchesProjectWindow', () => {
  it('includes the start and end dates and skips days outside them', () => {
    expect(
      activityMatchesProjectWindow('2026-01-01T00:00:00.000Z', '2026-01-01', '2026-04-30'),
    ).toBe(true);
    expect(
      activityMatchesProjectWindow('2026-04-30T23:00:00.000Z', '2026-01-01', '2026-04-30'),
    ).toBe(true);
    expect(
      activityMatchesProjectWindow('2025-12-31T23:00:00.000Z', '2026-01-01', '2026-04-30'),
    ).toBe(false);
    expect(
      activityMatchesProjectWindow('2026-05-01T00:00:00.000Z', '2026-01-01', '2026-04-30'),
    ).toBe(false);
  });

  it('matches every date when the project has no window', () => {
    expect(activityMatchesProjectWindow('2026-09-20T06:00:00.000Z', null, null)).toBe(true);
  });
});
