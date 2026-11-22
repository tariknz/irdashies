import { describe, expect, it } from 'vitest';
import { getDemoIncidents } from './incidentsDemo';

describe('getDemoIncidents', () => {
  it('grows the feed over time', () => {
    expect(getDemoIncidents(0)).toHaveLength(1);
    expect(getDemoIncidents(12).length).toBeGreaterThan(
      getDemoIncidents(0).length
    );
  });
});
