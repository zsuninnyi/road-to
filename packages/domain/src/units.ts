export type Units = 'metric' | 'imperial';

export function formatDistanceMeters(meters: number, units: Units): string {
  if (units === 'imperial') {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatSpeedMps(mps: number, units: Units): string {
  if (units === 'imperial') {
    return `${(mps * 2.236936).toFixed(1)} mph`;
  }
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

export function formatCalories(kcal: number): string {
  return `${Math.round(kcal)} kcal`;
}

/** Average pace from moving time and distance. Null if either value is unusable. */
export function formatPace(movingTimeS: number, distanceM: number, units: Units): string | null {
  if (
    !Number.isFinite(movingTimeS) ||
    !Number.isFinite(distanceM) ||
    movingTimeS <= 0 ||
    distanceM <= 0
  ) {
    return null;
  }
  const metersPerUnit = units === 'imperial' ? 1609.344 : 1000;
  const totalSeconds = Math.round(movingTimeS / (distanceM / metersPerUnit));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const suffix = units === 'imperial' ? '/mi' : '/km';
  return `${minutes}:${String(seconds).padStart(2, '0')} ${suffix}`;
}

export function formatDurationSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
