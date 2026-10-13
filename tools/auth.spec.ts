import { describe, expect, it } from 'vitest';
import { maskSecret } from './auth';

describe('iRacing OAuth masking', () => {
  it('matches the official protocol example including identifier normalization', () => {
    expect(
      maskSecret(
        'Anagram-tactics-FOOTING-OPACITY-SHONE-keenly',
        ' John.West@iracing.com '
      )
    ).toBe('KIhAi2ynNPWvJsebdluGaBaPTRaUACqTPDCfyUuv46Y=');
  });
});
