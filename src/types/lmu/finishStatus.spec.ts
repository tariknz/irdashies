import { describe, expect, it } from 'vitest';
import { LMU_FINISH_STATUS, lmuFinishStateFromCode } from './finishStatus';

describe('lmuFinishStateFromCode', () => {
  it("names the sim's three finish statuses", () => {
    expect(lmuFinishStateFromCode(LMU_FINISH_STATUS.finished)).toBe('FINISHED');
    expect(lmuFinishStateFromCode(LMU_FINISH_STATUS.dnf)).toBe('DNF');
    expect(lmuFinishStateFromCode(LMU_FINISH_STATUS.dq)).toBe('DQ');
  });

  it('draws nothing for a car still running', () => {
    expect(lmuFinishStateFromCode(LMU_FINISH_STATUS.none)).toBeUndefined();
    expect(lmuFinishStateFromCode(undefined)).toBeUndefined();
  });

  it('draws nothing for a code this build does not know', () => {
    expect(lmuFinishStateFromCode(4)).toBeUndefined();
    expect(lmuFinishStateFromCode(-1)).toBeUndefined();
  });
});
