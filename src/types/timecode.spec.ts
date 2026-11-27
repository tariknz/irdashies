import { describe, expect, it } from 'vitest';
import { formatTimecode } from './timecode';

describe('formatTimecode', () => {
  it('formats zero', () => {
    expect(formatTimecode(0)).toBe('00:00:00');
  });

  it('formats 59 seconds', () => {
    expect(formatTimecode(59)).toBe('00:00:59');
  });

  it('formats 3599 seconds (59:59)', () => {
    expect(formatTimecode(3599)).toBe('00:59:59');
  });

  it('formats 3600 seconds (1 hour)', () => {
    expect(formatTimecode(3600)).toBe('01:00:00');
  });

  it('formats 86399 seconds (23:59:59)', () => {
    expect(formatTimecode(86399)).toBe('23:59:59');
  });

  it('floors fractional seconds', () => {
    expect(formatTimecode(2477.9)).toBe('00:41:17');
  });

  it('returns 00:00:00 for negative', () => {
    expect(formatTimecode(-1)).toBe('00:00:00');
  });

  it('returns 00:00:00 for NaN', () => {
    expect(formatTimecode(NaN)).toBe('00:00:00');
  });

  it('returns 00:00:00 for Infinity', () => {
    expect(formatTimecode(Infinity)).toBe('00:00:00');
  });
});
