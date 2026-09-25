import { mapStravaSport, type Sport } from './sports.js';

/** First Strava import window. Full history backfill comes later. */
export const stravaInitialBackfillDays = 30;

export type NormalizedProviderActivity = {
  provider: 'strava';
  externalId: string;
  sport: Sport;
  title: string;
  startedAt: string;
  endedAt: string;
  timezone: string | null;
  distanceM: number | null;
  movingTimeS: number | null;
  elapsedTimeS: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgSpeedMps: number | null;
  calories: number | null;
  mapPolyline: string | null;
  hasGps: boolean;
  sportRaw: string | null;
};

export type StravaSummaryActivity = {
  id: number;
  name?: string | null;
  sport_type?: string | null;
  type?: string | null;
  start_date?: string | null;
  elapsed_time?: number | null;
  moving_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_speed?: number | null;
  calories?: number | null;
  timezone?: string | null;
  map?: { summary_polyline?: string | null; polyline?: string | null } | null;
};

export type HydratedStravaPayload = {
  activity: unknown;
  streams: unknown;
};

export type ActivityStreamsDto = {
  latlng: number[][] | null;
  timeS: number[] | null;
  altitudeM: number[] | null;
  heartrate: number[] | null;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseStravaSummary(input: unknown): StravaSummaryActivity | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const row = input as Record<string, unknown>;
  if (typeof row.id !== 'number' || !Number.isFinite(row.id)) {
    return null;
  }
  const map =
    typeof row.map === 'object' && row.map !== null
      ? (row.map as { summary_polyline?: string | null; polyline?: string | null })
      : null;
  return {
    id: row.id,
    name: asString(row.name),
    sport_type: asString(row.sport_type),
    type: asString(row.type),
    start_date: asString(row.start_date),
    elapsed_time: asFiniteNumber(row.elapsed_time),
    moving_time: asFiniteNumber(row.moving_time),
    distance: asFiniteNumber(row.distance),
    total_elevation_gain: asFiniteNumber(row.total_elevation_gain),
    average_heartrate: asFiniteNumber(row.average_heartrate),
    max_heartrate: asFiniteNumber(row.max_heartrate),
    average_speed: asFiniteNumber(row.average_speed),
    calories: asFiniteNumber(row.calories),
    timezone: asString(row.timezone),
    map,
  };
}

export function normalizeStravaSummary(
  input: StravaSummaryActivity,
): NormalizedProviderActivity | null {
  if (!input.start_date) {
    return null;
  }
  const started = new Date(input.start_date);
  if (Number.isNaN(started.getTime())) {
    return null;
  }
  const elapsed = input.elapsed_time ?? input.moving_time ?? 0;
  const ended = new Date(started.getTime() + Math.max(0, elapsed) * 1000);
  const polylineRaw = input.map?.polyline?.trim() || input.map?.summary_polyline?.trim() || '';
  const polyline = polylineRaw.length > 0 ? polylineRaw : null;
  const title = input.name?.trim() ? input.name.trim() : 'Untitled';

  return {
    provider: 'strava',
    externalId: String(input.id),
    sport: mapStravaSport(input.sport_type, input.type),
    title,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    timezone: input.timezone ?? null,
    distanceM: input.distance ?? null,
    movingTimeS: input.moving_time ?? null,
    elapsedTimeS: input.elapsed_time ?? null,
    elevationGainM: input.total_elevation_gain ?? null,
    avgHr: input.average_heartrate ?? null,
    maxHr: input.max_heartrate ?? null,
    avgSpeedMps: input.average_speed ?? null,
    calories: input.calories ?? null,
    mapPolyline: polyline,
    hasGps: polyline !== null,
    sportRaw: input.sport_type ?? input.type ?? null,
  };
}

export function activityFingerprint(input: {
  startedAt: string;
  sport: string;
  distanceM: number | null;
}): string {
  const distance = input.distanceM == null ? '' : String(Math.round(input.distanceM));
  return `${input.startedAt}|${input.sport}|${distance}`;
}

export function stravaBackfillAfterUnix(nowMs: number): number {
  return Math.floor((nowMs - stravaInitialBackfillDays * 24 * 60 * 60 * 1000) / 1000);
}

export function isHydratedStravaPayload(value: unknown): value is HydratedStravaPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return 'activity' in value && 'streams' in value;
}

export function asJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return asJsonRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function trimStravaDetail(activity: unknown): Record<string, unknown> {
  const row = asJsonRecord(activity);
  const { segment_efforts: _segments, best_efforts: _best, ...rest } = row;
  return rest;
}

function streamSeries(streams: unknown, key: string): unknown[] | null {
  if (Array.isArray(streams)) {
    const row = streams.find(
      (item) =>
        typeof item === 'object' && item !== null && (item as { type?: string }).type === key,
    ) as { data?: unknown } | undefined;
    return Array.isArray(row?.data) ? row.data : null;
  }
  if (typeof streams !== 'object' || streams === null) {
    return null;
  }
  const entry = (streams as Record<string, unknown>)[key];
  if (Array.isArray(entry)) {
    return entry;
  }
  if (
    typeof entry === 'object' &&
    entry !== null &&
    Array.isArray((entry as { data?: unknown }).data)
  ) {
    return (entry as { data: unknown[] }).data;
  }
  return null;
}

export function parseStravaStreams(streams: unknown): ActivityStreamsDto {
  const latlngRaw = streamSeries(streams, 'latlng');
  const latlng = latlngRaw?.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number',
  )
    ? (latlngRaw as number[][])
    : null;
  const numbers = (key: string): number[] | null => {
    const series = streamSeries(streams, key);
    return series?.every((item) => typeof item === 'number' && Number.isFinite(item))
      ? (series as number[])
      : null;
  };
  return {
    latlng,
    timeS: numbers('time'),
    altitudeM: numbers('altitude'),
    heartrate: numbers('heartrate'),
  };
}
