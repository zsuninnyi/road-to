export const providers = ['strava', 'garmin', 'whoop', 'trainingpeaks'] as const;
export type Provider = (typeof providers)[number];

export const activityVisibilities = ['private', 'public'] as const;
export type ActivityVisibility = (typeof activityVisibilities)[number];

export const healthSampleKinds = ['sleep', 'recovery', 'hrv', 'rhr', 'strain', 'steps'] as const;
export type HealthSampleKind = (typeof healthSampleKinds)[number];

export const brandName = 'RoadTo';

export function formatBrandTitle(brand: string, projectName?: string | null): string {
  const trimmed = projectName?.trim();
  return trimmed ? `${brand} ${trimmed}` : brand;
}

export { sortProjectActivityList, type ProjectListActivity } from './project-list.js';
export { sports, mapStravaSport, type Sport } from './sports.js';
export {
  formatCalories,
  formatDistanceMeters,
  formatDurationSeconds,
  formatSpeedMps,
  type Units,
} from './units.js';
export { decodePolyline } from './polyline.js';
export {
  activityFingerprint,
  asJsonRecord,
  isHydratedStravaPayload,
  normalizeStravaSummary,
  parseStravaStreams,
  parseStravaSummary,
  stravaBackfillAfterUnix,
  stravaInitialBackfillDays,
  trimStravaDetail,
  type ActivityStreamsDto,
  type HydratedStravaPayload,
  type NormalizedProviderActivity,
  type StravaSummaryActivity,
} from './strava.js';
