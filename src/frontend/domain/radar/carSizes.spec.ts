import { describe, expect, it } from 'vitest';
import { resolveCarSize, typicalCarSize } from './carSizes';

const fallback = { length: 4.5, width: 1.9 };

describe('typicalCarSize', () => {
  it.each([
    ['NASCAR Cup Series Next Gen', 5.2],
    ['GTP', 5.1],
    ['LMP2', 4.75],
    ['GT3 Class', 4.6],
    ['Porsche 911 GT3 Cup (992)', 4.6],
    ['GT4', 4.5],
    ['Global Mazda MX-5 Cup', 4.0],
    ['Dallara IR18', 5.2],
    ['FIA F4', 4.3],
    ['NASCAR Craftsman Truck Series', 5.6],
    ['Porsche 963 GTP', 5.1],
    ['Porsche 718 Cayman GT4 Clubsport MR', 4.5],
  ])('%s is %s m long', (name, length) => {
    expect(typicalCarSize(name)?.length).toBe(length);
  });

  it('tries the class name before the car name', () => {
    expect(typicalCarSize('LMP2', 'Dallara P217')?.length).toBe(4.75);
  });

  it('knows nothing about an unknown name', () => {
    expect(typicalCarSize('Mystery Kart', undefined)).toBeNull();
  });
});

describe('resolveCarSize', () => {
  it('prefers a saved class override, then the typical size', () => {
    const options = {
      sizeByClass: true,
      classSizes: { GTP: { length: 5.4, width: 2.0 } },
      fallback,
    };
    expect(resolveCarSize('GTP', undefined, options).length).toBe(5.4);
    expect(resolveCarSize('GT3 Class', undefined, options).length).toBe(4.6);
    expect(resolveCarSize('Kart', 'Kart', options)).toEqual(fallback);
  });

  it('uses the default size for everyone when sizing by class is off', () => {
    expect(
      resolveCarSize('GTP', undefined, {
        sizeByClass: false,
        classSizes: {},
        fallback,
      })
    ).toEqual(fallback);
  });

  it('ignores a broken saved override', () => {
    expect(
      resolveCarSize('GTP', undefined, {
        sizeByClass: true,
        classSizes: { GTP: { length: Number.NaN, width: 2 } },
        fallback,
      }).length
    ).toBe(5.1);
  });
});
