const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date `YYYY-MM-DD`, or null when the value is empty. Invalid text is rejected. */
export function readProjectWindowDate(value: string | null | undefined): string | null | undefined {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = isoDate.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return trimmed;
}

export type ProjectWindow = {
  windowStart: string | null;
  windowEnd: string | null;
};

/** Empty bounds are open. A start after the end, or a bad date, is rejected. */
export function readProjectWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): ProjectWindow | null {
  const windowStart = readProjectWindowDate(start);
  const windowEnd = readProjectWindowDate(end);
  if (windowStart === undefined || windowEnd === undefined) {
    return null;
  }
  if (windowStart && windowEnd && windowStart > windowEnd) {
    return null;
  }
  return { windowStart, windowEnd };
}

/**
 * Inclusive window on the UTC calendar date of `startedAt`.
 * A missing bound is open. No bounds means every date matches.
 */
export function activityMatchesProjectWindow(
  startedAt: string,
  windowStart: string | null,
  windowEnd: string | null,
): boolean {
  if (!windowStart && !windowEnd) {
    return true;
  }
  const day = startedAt.slice(0, 10);
  if (!isoDate.test(day)) {
    return false;
  }
  if (windowStart && day < windowStart) {
    return false;
  }
  if (windowEnd && day > windowEnd) {
    return false;
  }
  return true;
}
