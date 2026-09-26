import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderRoute, signedInUser, stubSession } from '../../test/router';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppPage', () => {
  it('shows the connect Strava CTA when nothing is linked', async () => {
    stubSession(signedInUser);
    await renderRoute('/app');

    expect(await screen.findByRole('heading', { name: 'Activities' })).toBeInTheDocument();
    expect(
      screen.getByText('Connect Strava to import the last month of activities.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Strava' })).toBeInTheDocument();
  });

  it('shows API connected when health succeeds', async () => {
    stubSession(signedInUser);
    await renderRoute('/app');

    expect(await screen.findByText('API connected')).toBeInTheDocument();
  });

  it('lists imported activities', async () => {
    stubSession(signedInUser, {
      integrations: [
        {
          id: 'int_1',
          provider: 'strava',
          status: 'active',
          externalUserId: '42',
          lastSyncAt: '2026-09-23T12:00:00.000Z',
        },
      ],
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
          mapPolyline: '_p~iF~ps|U',
          sources: [{ provider: 'strava' }],
        },
      ],
    });
    await renderRoute('/app');

    expect(await screen.findByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Morning Run' })).toHaveAttribute(
      'href',
      '/app/activities/act_1',
    );
    expect(screen.getByText('10.2 km · 58:20 · 5:43 /km')).toBeInTheDocument();
    expect(screen.getByText('Strava connected')).toBeInTheDocument();
  });
});
