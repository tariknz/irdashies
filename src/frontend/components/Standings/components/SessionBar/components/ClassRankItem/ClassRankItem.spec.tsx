import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValues,
} from '@irdashies/context';
import { ClassRankItem } from './ClassRankItem';

vi.mock('@irdashies/context');

describe('ClassRankItem', () => {
  it('excludes pace cars and spectators from the class total', () => {
    vi.mocked(useDriverCarIdx).mockReturnValue(1);
    vi.mocked(useSessionDrivers).mockReturnValue([
      { CarIdx: 0, CarClassID: 10 },
      { CarIdx: 1, CarClassID: 10 }, // player
      { CarIdx: 2, CarClassID: 10 },
      // Pace car shares the player's CarClassID but isn't a real competitor
      { CarIdx: 3, CarClassID: 10, CarIsPaceCar: 1 },
      // Spectator also shares the player's CarClassID
      { CarIdx: 4, CarClassID: 10, IsSpectator: 1 },
    ] as never);
    vi.mocked(useTelemetryValues).mockReturnValue([0, 2, 0, 0, 0] as never);

    const { container } = render(
      <ClassRankItem settings={undefined} standalone={false} />
    );

    expect(container.textContent).toBe('2/3');
  });
});
