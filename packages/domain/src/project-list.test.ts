import { describe, expect, it } from 'vitest';
import { sortProjectActivityList } from './project-list.js';

const activities = [
  { id: 'easy', startedAt: '2026-03-01T08:00:00Z' },
  { id: 'marathon', startedAt: '2026-04-20T07:00:00Z' },
  { id: 'long-run', startedAt: '2026-04-12T09:00:00Z' },
];

describe('sortProjectActivityList', () => {
  it('orders by newest start when nothing is pinned', () => {
    expect(sortProjectActivityList(activities).map((activity) => activity.id)).toEqual([
      'marathon',
      'long-run',
      'easy',
    ]);
  });

  it('keeps the pinned race at the top even if it is not the newest', () => {
    const oldestRace = [
      { id: 'marathon', startedAt: '2026-01-01T08:00:00Z' },
      { id: 'long-run', startedAt: '2026-04-12T09:00:00Z' },
      { id: 'easy', startedAt: '2026-03-01T08:00:00Z' },
    ];

    expect(
      sortProjectActivityList(oldestRace, 'marathon').map((activity) => activity.id),
    ).toEqual(['marathon', 'long-run', 'easy']);
  });

  it('does not duplicate the pinned activity in the rest of the list', () => {
    const sorted = sortProjectActivityList(activities, 'marathon');
    expect(sorted.filter((activity) => activity.id === 'marathon')).toHaveLength(1);
    expect(sorted[0]?.id).toBe('marathon');
  });

  it('ignores a pin that is not in the list', () => {
    expect(sortProjectActivityList(activities, 'missing').map((activity) => activity.id)).toEqual([
      'marathon',
      'long-run',
      'easy',
    ]);
  });
});
