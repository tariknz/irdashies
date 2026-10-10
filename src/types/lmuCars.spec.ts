import { describe, expect, it } from 'vitest';
import { CAR_MANUFACTURER_SPRITE_POSITIONS } from '../frontend/components/Standings/components/CarManufacturer/carManufacturerSpritePositions';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../frontend/components/Standings/components/CarManufacturer/carManufacturerMapping';
import { LMU_CAR_ID_TO_MANUFACTURER, LMU_MANUFACTURERS } from './lmuCars';

describe('LMU manufacturers', () => {
  it('names a badge that exists in the sprite sheet', () => {
    // A key with no sprite renders nothing, silently -- which is the one
    // failure mode of a hand-written list of names.
    LMU_MANUFACTURERS.forEach(({ manufacturer, name }) => {
      expect(
        manufacturer in CAR_MANUFACTURER_SPRITE_POSITIONS,
        `${name} has no sprite for '${manufacturer}'`
      ).toBe(true);
    });
  });

  it('is reachable from the id lookup the renderer uses', () => {
    // The ids were defined for the mapper and the lookup for the renderer,
    // with nothing joining them, so the renderer knew none of them: no badge
    // in the standings, and the manufacturer-position item bailed before it
    // rendered, because it resolves the player's manufacturer here too.
    LMU_MANUFACTURERS.forEach(({ id, manufacturer }) => {
      expect(CAR_ID_TO_CAR_MANUFACTURER[id]?.manufacturer).toBe(manufacturer);
    });
  });

  it('does not collide with an iRacing car id', () => {
    const lmuIds = new Set(LMU_MANUFACTURERS.map(({ id }) => id));
    // Every shared entry must be the LMU one, or an iRacing car would borrow
    // an LMU badge or vice versa.
    lmuIds.forEach((id) => {
      expect(CAR_ID_TO_CAR_MANUFACTURER[id]).toEqual(
        LMU_CAR_ID_TO_MANUFACTURER[id]
      );
    });
  });

  it('assigns each manufacturer a distinct id', () => {
    const ids = LMU_MANUFACTURERS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves a chassis maker ahead of an engine supplier', () => {
    // "Ligier JS P320 Nissan" must be a Ligier, not a Nissan.
    const matched = LMU_MANUFACTURERS.find(({ pattern }) =>
      pattern.test('Ligier JS P320 Nissan')
    );
    expect(matched?.manufacturer).toBe('ligier');
  });
});
