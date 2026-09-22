export const providers = ['strava', 'garmin', 'whoop', 'trainingpeaks'] as const;
export type Provider = (typeof providers)[number];

export const activityVisibilities = ['private', 'public'] as const;
export type ActivityVisibility = (typeof activityVisibilities)[number];

export const healthSampleKinds = ['sleep', 'recovery', 'hrv', 'rhr', 'strain', 'steps'] as const;
export type HealthSampleKind = (typeof healthSampleKinds)[number];
