import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderRoute, signedInUser, stubSession } from '../../../test/router';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const morningRun = {
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
  sources: [{ provider: 'strava' as const }],
  timezone: '(GMT+02:00) Europe/Budapest',
  maxHr: 171,
  avgSpeedMps: 2.91,
  calories: 640,
  hydrated: true,
  streams: {
    latlng: null,
    timeS: [0, 10],
    altitudeM: [110, 112],
    heartrate: [140, 145],
  },
};

describe('ActivityDetailPage', () => {
  it('shows hydrated stats from the API', async () => {
    stubSession(signedInUser, { activity: morningRun });
    await renderRoute('/app/activities/act_1');

    expect(await screen.findByRole('heading', { name: 'Morning Run' })).toBeInTheDocument();
    expect(screen.getByText('Strava')).toBeInTheDocument();
    expect(screen.getByText('5:43 /km')).toBeInTheDocument();
    expect(screen.getByText('Pace')).toBeInTheDocument();
    expect(screen.getByText('171 bpm')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Heart rate' })).toBeInTheDocument();
  });

  it('shows an error when the activity is missing', async () => {
    stubSession(signedInUser);
    await renderRoute('/app/activities/missing');

    expect(await screen.findByText('Could not load this activity.')).toBeInTheDocument();
  });
});
