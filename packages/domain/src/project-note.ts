import { formatDistanceMeters, type Units } from './units.js';

/** Plain progress note. The wording gets a proper editor later. */
export function formatProjectProgressNote(
  projectName: string,
  totalDistanceM: number,
  units: Units,
): string {
  return `${projectName.trim()} — ${formatDistanceMeters(totalDistanceM, units)}`;
}
