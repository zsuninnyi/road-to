import { describe, expect, it } from 'vitest';
import { formatProjectProgressNote } from './project-note.js';

describe('formatProjectProgressNote', () => {
  it('joins the project name and the sport total', () => {
    expect(formatProjectProgressNote('Road to Marathon', 10_200, 'metric')).toBe(
      'Road to Marathon — 10.2 km',
    );
  });
});
