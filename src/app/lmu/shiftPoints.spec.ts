import { describe, it, expect } from 'vitest';
import { lmuShiftPointRpm } from './shiftPoints';

describe('lmuShiftPointRpm', () => {
  it.each([
    ['Aston Martin Vantage AMR LMGT3', 6950],
    ['Lamborghini Huracan LMGT3 Evo2', 8200],
    ['Mercedes-AMG LMGT3', 7000],
    ['Porsche 911 GT3 R LMGT3', 8800],
    ['McLaren 720S LMGT3 Evo', 7600],
    ['Lexus RCF LMGT3', 6950],
    ['Ford Mustang LMGT3', 7950],
    ['Ferrari 296 LMGT3', 7300],
    ['Ferrari 296 LMGT3 Evo', 7300],
    ['BMW M4 LMGT3', 6950],
    // 30 bytes in shared memory, so it may arrive cut short.
    ['Chevrolet Corvette Z06 LMGT3.', 7600],
  ])('knows the GT3 %s', (model, rpm) => {
    expect(lmuShiftPointRpm('LMGT3', model)).toBe(rpm);
  });

  it('gives every LMP2 the same shift point', () => {
    expect(lmuShiftPointRpm('LMP2', 'Oreca 07')).toBe(8240);
    expect(lmuShiftPointRpm('LMP2', undefined)).toBe(8240);
  });

  it('leaves LMP3 to the 95% guess', () => {
    expect(lmuShiftPointRpm('LMP3', 'Ligier JS P325')).toBeUndefined();
    expect(lmuShiftPointRpm('LMP3', 'Duqueine D09 P3')).toBeUndefined();
  });

  it('has no figure for a GTE of a GT3 make', () => {
    expect(lmuShiftPointRpm('LMGTE', 'Ferrari 488 GTE EVO')).toBeUndefined();
    expect(lmuShiftPointRpm('LMGTE', 'Porsche 911 RSR-19')).toBeUndefined();
  });

  it('has no figure for a Hypercar or an unknown car', () => {
    expect(lmuShiftPointRpm('Hypercar', 'Ferrari 499P')).toBeUndefined();
    expect(lmuShiftPointRpm('LMGT3', 'Some Future GT3')).toBeUndefined();
    expect(lmuShiftPointRpm(undefined, 'BMW M4 LMGT3')).toBeUndefined();
  });
});
