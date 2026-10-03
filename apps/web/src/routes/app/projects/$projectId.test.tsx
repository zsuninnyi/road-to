import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderRoute, signedInUser, stubSession } from '../../../test/router';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('project activity list', () => {
  it('shows the same activity row as the activity list', async () => {
    stubSession(signedInUser, {
      activities: [
        {
          id: 'act_1',
          sport: 'run',
          title: 'Morning Run',
          startedAt: '2026-09-20T06:00:00.000Z',
          endedAt: '2026-09-20T07:00:00.000Z',
          distanceM: 10200,
          movingTimeS: 3500,
          elapsedTimeS: 3600,
          elevationGainM: 80,
          avgHr: 148,
          mapPolyline: null,
          description: 'Easy shakeout',
          visibility: 'private',
          sources: [{ provider: 'strava' }],
        },
      ],
    });
    await renderRoute('/app/projects/project_1?name=Marathon');

    expect(await screen.findByRole('link', { name: 'Morning Run' })).toHaveAttribute(
      'href',
      '/app/activities/act_1',
    );
    expect(screen.getByText('Easy shakeout')).toBeInTheDocument();
    expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
    expect(screen.getByText('10.2 km · 58:20 · 5:43 /km')).toBeInTheDocument();
  });
});
