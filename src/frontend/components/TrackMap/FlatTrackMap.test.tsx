import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FlatTrackMap } from './FlatTrackMap';
import { TrackDriver, TrackDrawing } from './TrackCanvas';

describe('FlatTrackMap', () => {
  const mockTrackDrawing: TrackDrawing = {
    active: { inside: '', outside: '', trackPathPoints: [{ x: 100, y: 100 }] },
    startFinish: {},
    turns: [{ x: 100, y: 100, content: 'T1' }],
  };

  const mockDrivers: TrackDriver[] = [
    {
      driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1, CarClassColor: 0xff0000 } as any,
      progress: 0.5,
      isPlayer: true,
    },
  ];

  it('should render canvas', () => {
    const { container } = render(
      <FlatTrackMap
        trackDrawing={mockTrackDrawing}
        drivers={mockDrivers}
      />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
