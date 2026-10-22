import { describe, expect, it } from 'vitest';
import { isLmuAiControlled, isLmuAiEntry, lmuPlayerSlot } from './aiControl';

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

describe('lmuPlayerSlot', () => {
  it('reports the slot the telemetry block names', () => {
    expect(
      lmuPlayerSlot({ playerHasVehicle: true, playerVehicleIdx: 20 })
    ).toBe(20);
    expect(lmuPlayerSlot({ playerHasVehicle: true, playerVehicleIdx: 0 })).toBe(
      0
    );
  });

  it('reports none when the player has no car', () => {
    // Spectating, which is the other state where the player's own entry is
    // not the one driving.
    expect(
      lmuPlayerSlot({ playerHasVehicle: false, playerVehicleIdx: 20 })
    ).toBe(-1);
    expect(lmuPlayerSlot({ playerVehicleIdx: 20 })).toBe(-1);
    expect(lmuPlayerSlot({ playerHasVehicle: true })).toBe(-1);
    expect(
      lmuPlayerSlot({ playerHasVehicle: true, playerVehicleIdx: -1 })
    ).toBe(-1);
  });
});

describe('isLmuAiEntry', () => {
  it('never calls the player an AI, whatever control says', () => {
    // The bug this exists for: LMU holds your car under AI control until you
    // take it, so your own entry reads control 1 while you sit in the garage.
    // A plain control test kept your name out of the rating lookup, withheld
    // the rank from your row and drew the "AI" badge on it, while every other
    // driver -- already in their car -- was ranked.
    expect(isLmuAiEntry({ control: 1, isPlayer: true })).toBe(false);
    expect(isLmuAiEntry({ control: 0, isPlayer: true })).toBe(false);
    expect(isLmuAiEntry({ isPlayer: true })).toBe(false);
  });

  it('still calls an AI an AI', () => {
    expect(isLmuAiEntry({ control: 1, isPlayer: false })).toBe(true);
    expect(isLmuAiEntry({ control: 1 })).toBe(true);
  });

  it('leaves a remote human alone', () => {
    expect(isLmuAiEntry({ control: 2 })).toBe(false);
    expect(isLmuAiEntry({ control: 0 })).toBe(false);
  });

  it('still says nothing when the sim did not report control', () => {
    expect(isLmuAiEntry({})).toBeUndefined();
    expect(isLmuAiEntry({ isPlayer: false })).toBeUndefined();
  });
});
