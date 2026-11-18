import { describe, expect, it } from 'vitest';
import { NO_PLAN_HINT, mismatchText, progressNotice } from './progressNotice';

describe('progressNotice', () => {
  it('waits for the first snapshot', () => {
    expect(progressNotice(undefined)?.kind).toBe('loading');
  });

  it('points to the settings without a plan', () => {
    expect(progressNotice({ status: 'no-plan' })).toEqual({
      kind: 'no-plan',
      title: 'No race plan loaded',
      hint: NO_PLAN_HINT,
    });
  });

  it('says replays are not tracked', () => {
    expect(progressNotice({ status: 'replay' })?.kind).toBe('replay');
  });

  it('shows the plan otherwise', () => {
    for (const status of ['waiting', 'racing', 'finished'] as const) {
      expect(progressNotice({ status })).toBeNull();
    }
  });
});

describe('mismatchText', () => {
  it('names what does not match', () => {
    expect(mismatchText([])).toBeNull();
    expect(mismatchText(['team'])).toBe('This plan is for a different team');
    expect(mismatchText(['track'])).toBe('This plan is for a different track');
    expect(mismatchText(['track', 'team'])).toBe(
      'This plan is for a different team and track'
    );
  });
});
