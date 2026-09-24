export const sports = ['run', 'ride', 'swim', 'walk', 'hike', 'ski', 'strength', 'other'] as const;

export type Sport = (typeof sports)[number];

const stravaSportMap: Record<string, Sport> = {
  AlpineSki: 'ski',
  BackcountrySki: 'ski',
  EBikeRide: 'ride',
  GravelRide: 'ride',
  Hike: 'hike',
  MountainBikeRide: 'ride',
  NordicSki: 'ski',
  Ride: 'ride',
  Run: 'run',
  Snowboard: 'ski',
  Swim: 'swim',
  TrailRun: 'run',
  VirtualRide: 'ride',
  VirtualRun: 'run',
  Walk: 'walk',
  WeightTraining: 'strength',
  Workout: 'strength',
  Yoga: 'strength',
};

export function mapStravaSport(
  sportType: string | null | undefined,
  fallbackType?: string | null,
): Sport {
  const key = sportType ?? fallbackType ?? '';
  return stravaSportMap[key] ?? 'other';
}
