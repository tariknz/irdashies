import { describe, expect, it } from 'vitest';
import { isLmuAiControlled } from './aiControl';

describe('isLmuAiControlled', () => {
  it('names only local AI as AI', () => {
    // 0 local player, 1 local AI, 2 remote, 3 replay.
    expect(isLmuAiControlled(1)).toBe(true);
    expect(isLmuAiControlled(0)).toBe(false);
    expect(isLmuAiControlled(2)).toBe(false);
    expect(isLmuAiControlled(3)).toBe(false);
  });

  it('says nothing when the sim did not report control', () => {
    // Not false: a caller withholding a rating from an AI has to tell "this
    // is a person" from "nobody said", and treat the second as a person. A
    // false here would quietly cost humans their ranks on an older build.
    expect(isLmuAiControlled(undefined)).toBeUndefined();
  });

  it('treats an unreported entry as eligible under the caller\u2019s test', () => {
    // The shape every caller uses: `!isLmuAiControlled(control)`.
    expect(!isLmuAiControlled(undefined)).toBe(true);
    expect(!isLmuAiControlled(1)).toBe(false);
  });
});
