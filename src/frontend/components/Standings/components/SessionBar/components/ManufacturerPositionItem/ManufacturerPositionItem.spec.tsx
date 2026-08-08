import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionBarSnapshot } from '@irdashies/context';
import { ManufacturerPositionItem } from './ManufacturerPositionItem';

vi.mock('@irdashies/context');

// carId 56 = NASCAR Cup Series Toyota Camry (see carManufacturerMapping.ts)
const TOYOTA_CAR_ID = 56;

describe('ManufacturerPositionItem', () => {
  it('excludes pace cars and spectators from the manufacturer total', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      playerCarId: TOYOTA_CAR_ID,
      playerClassified: true,
      playerOverallPosition: 2,
      competitorCarIds: [TOYOTA_CAR_ID, TOYOTA_CAR_ID, TOYOTA_CAR_ID],
      competitorPositions: [1, 2, 3],
    } as never);

    const { container } = render(
      <ManufacturerPositionItem settings={undefined} standalone={false} />
    );

    expect(container.textContent).toBe('2/3');
  });

  it('hides an unclassified player', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      playerCarId: TOYOTA_CAR_ID,
      playerClassified: false,
      playerOverallPosition: 0,
      competitorCarIds: [TOYOTA_CAR_ID],
      competitorPositions: [1],
    } as never);
    const { container } = render(
      <ManufacturerPositionItem settings={undefined} standalone={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
