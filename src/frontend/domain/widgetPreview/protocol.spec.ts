import { describe, expect, it } from 'vitest';
import { parsePreviewRequest } from './protocol';

describe('preview protocol', () => {
  it('accepts only registered channel names and supported rates', () => {
    expect(parsePreviewRequest({ type: 'preview:ready' })).toEqual({
      type: 'preview:ready',
    });
    expect(
      parsePreviewRequest({
        type: 'preview:subscribe',
        channel: 'driver-controls.snapshot',
        rate: 25,
      })
    ).toMatchObject({ rate: 25 });
    for (const rate of [-1, 0, NaN, Infinity, 1000, '25'])
      expect(
        parsePreviewRequest({
          type: 'preview:subscribe',
          channel: 'driver-controls.snapshot',
          rate,
        })
      ).toBeUndefined();
    expect(
      parsePreviewRequest({
        type: 'preview:subscribe',
        channel: 'session.lifecycle',
        rate: 1,
      })
    ).toBeUndefined();
    expect(
      parsePreviewRequest({ type: 'preview:subscribe', channel: '__proto__' })
    ).toBeUndefined();
    expect(parsePreviewRequest({ type: 'toggleDemoMode' })).toBeUndefined();
    expect(
      parsePreviewRequest({
        type: 'preview:asset',
        kind: 'garageCover',
        filename: 'cover.png',
        requestId: 1,
      })
    ).toMatchObject({ filename: 'cover.png' });
    expect(
      parsePreviewRequest({
        type: 'preview:asset',
        kind: 'arbitraryFile',
        filename: 'config.json',
        requestId: 1,
      })
    ).toBeUndefined();
  });
});
