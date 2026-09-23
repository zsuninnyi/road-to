export type ProjectListActivity = {
  id: string;
  startedAt: string;
};

/** Pinned goal activity first (once), then newest `startedAt` first. */
export function sortProjectActivityList<T extends ProjectListActivity>(
  activities: readonly T[],
  pinnedActivityId?: string | null,
): T[] {
  const pinnedId = pinnedActivityId?.trim() ? pinnedActivityId.trim() : null;
  const pinned: T[] = [];
  const rest: T[] = [];

  for (const activity of activities) {
    if (pinnedId && activity.id === pinnedId) {
      pinned.push(activity);
    } else {
      rest.push(activity);
    }
  }

  rest.sort((left, right) => {
    if (left.startedAt === right.startedAt) {
      return 0;
    }
    return left.startedAt < right.startedAt ? 1 : -1;
  });

  return [...pinned, ...rest];
}
