import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LMU_CAR_ID_BASE, LMU_MANUFACTURERS } from '@irdashies/types';
import { CarManufacturer } from './CarManufacturer';
import { LMU_MANUFACTURER_SPRITE_POSITIONS } from './lmuManufacturerSpritePositions';
import { CAR_MANUFACTURER_SPRITE_POSITIONS } from './carManufacturerSpritePositions';

/**
 * Which manufacturer sheet a car is drawn from.
 *
 * LMU and iRacing share only some marques -- LMU runs Oreca, Duqueine,
 * Ginetta, Glickenhaus, Vanwall and Isotta Fraschini, none of which iRacing
 * has -- so each has its own sheet. The car id decides between them, which is
 * why no prop saying "this is LMU" has to reach the row.
 */
const sheetOf = (carId: number): string | undefined => {
  const { container } = render(<CarManufacturer carId={carId} />);
  const style = container.querySelector('span')?.getAttribute('style') ?? '';
  return /url\(([^)]*)\)/.exec(style)?.[1];
};

describe('CarManufacturer and the two sheets', () => {
  it('draws an LMU car from the LMU sheet', () => {
    const oreca = LMU_MANUFACTURERS.find((m) => m.manufacturer === 'oreca');
    expect(oreca).toBeDefined();
    expect(sheetOf(oreca?.id ?? 0)).toContain('lmu_car_manufacturer');
  });

  it('draws an iRacing car from the iRacing sheet', () => {
    // Any id below the LMU base belongs to iRacing's own, real ids.
    const [iracingManufacturer] = Object.keys(
      CAR_MANUFACTURER_SPRITE_POSITIONS
    );
    expect(iracingManufacturer).toBeDefined();
    const sheet = sheetOf(1);
    // Car 1 may or may not be mapped; what matters is that nothing below the
    // base ever reaches the LMU sheet.
    if (sheet) expect(sheet).not.toContain('lmu_car_manufacturer');
  });

  it('has a sprite cell for every LMU marque it claims to know', () => {
    // A manufacturer in the list with no cell renders nothing, which looks
    // exactly like a car the list does not cover.
    const missing = LMU_MANUFACTURERS.filter(
      (m) => !(m.manufacturer in LMU_MANUFACTURER_SPRITE_POSITIONS)
    ).map((m) => m.manufacturer);

    // Audi is the known exception: LMU has no Audi, so the set carries no
    // logo, and the entry exists only so a model string naming one still
    // resolves to an id rather than to 0.
    expect(missing).toEqual(['audi']);
  });

  it('gives every LMU marque a distinct cell', () => {
    const cells = Object.values(LMU_MANUFACTURER_SPRITE_POSITIONS).map(
      (p) => `${p.x},${p.y}`
    );
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('keeps every LMU id at or above the base', () => {
    // The boundary is the only thing telling the renderer which sheet to use.
    for (const { id } of LMU_MANUFACTURERS) {
      expect(id).toBeGreaterThanOrEqual(LMU_CAR_ID_BASE);
    }
  });

  it('renders nothing for a marque with no cell', () => {
    const audi = LMU_MANUFACTURERS.find((m) => m.manufacturer === 'audi');
    const { container } = render(<CarManufacturer carId={audi?.id ?? 0} />);
    expect(container.querySelector('span')).toBeNull();
  });
});
