import { describe, expect, it } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import {
  activeProfile,
  applyProfileChange,
  isOvalTrack,
  profileView,
} from './radarProfile';

const base = getWidgetDefaultConfig('radar');

describe('isOvalTrack', () => {
  it('recognises every kind of oval', () => {
    expect(isOvalTrack('oval')).toBe(true);
    expect(isOvalTrack('dirt oval')).toBe(true);
    expect(isOvalTrack('road course')).toBe(false);
    expect(isOvalTrack(undefined)).toBe(false);
  });
});

describe('activeProfile', () => {
  it('picks the oval profile on ovals only while auto is on', () => {
    expect(activeProfile(base, 'oval')).toBe('oval');
    expect(activeProfile(base, 'road course')).toBe('road');
    expect(activeProfile({ ...base, autoProfile: false }, 'oval')).toBe('road');
  });
});

describe('profile editing', () => {
  it('shows the road settings on the oval until it is edited', () => {
    expect(profileView(base, 'oval').range).toBe(base.range);
  });

  it('keeps oval changes to the oval and shares the rest', () => {
    const change = applyProfileChange(base, 'oval', {
      range: 50,
      hideInPit: false,
    });
    const next = { ...base, ...change };
    expect(next.hideInPit).toBe(false);
    expect(next.range).toBe(base.range);
    expect(profileView(next, 'oval').range).toBe(50);
    expect(profileView(next, 'oval').trackWidth).toBe(base.trackWidth);
  });

  it('writes road changes straight into the config', () => {
    expect(applyProfileChange(base, 'road', { range: 40 })).toEqual({
      range: 40,
    });
  });
});
