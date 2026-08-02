import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValues,
} from '@irdashies/context';
import { ManufacturerPositionItem } from './ManufacturerPositionItem';

vi.mock('@irdashies/context');

// carId 56 = NASCAR Cup Series Toyota Camry (see carManufacturerMapping.ts)
const TOYOTA_CAR_ID = 56;

describe('ManufacturerPositionItem', () => {
  it('excludes pace cars and spectators from the manufacturer total', () => {
    vi.mocked(useDriverCarIdx).mockReturnValue(1);
    vi.mocked(useSessionDrivers).mockReturnValue([
      { CarIdx: 0, CarID: TOYOTA_CAR_ID },
      { CarIdx: 1, CarID: TOYOTA_CAR_ID }, // player
      { CarIdx: 2, CarID: TOYOTA_CAR_ID },
      // Pace car happens to report the same CarID but isn't a real competitor
      { CarIdx: 3, CarID: TOYOTA_CAR_ID, CarIsPaceCar: 1 },
      // Spectator also shares the player's CarID
      { CarIdx: 4, CarID: TOYOTA_CAR_ID, IsSpectator: 1 },
    ] as never);
    vi.mocked(useTelemetryValues).mockReturnValue([1, 2, 3, 0, 0] as never);

    const { container } = render(
      <ManufacturerPositionItem settings={undefined} standalone={false} />
    );

    expect(container.textContent).toBe('2/3');
  });
});
