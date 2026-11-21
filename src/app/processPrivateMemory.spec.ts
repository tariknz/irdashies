import { describe, expect, it } from 'vitest';

import { parsePrivateMemoryKB } from './processPrivateMemory';

describe('Linux process private memory', () => {
  it('sums clean and dirty private pages from smaps_rollup', () => {
    const rollup = [
      'Rss:                  1000 kB',
      'Pss:                   700 kB',
      'Private_Clean:         1024 kB',
      'Private_Dirty:         2048 kB',
      'SwapPss:                  0 kB',
      '',
    ].join('\n');

    expect(parsePrivateMemoryKB(rollup)).toBe(3072);
  });

  it('sums private-memory counters from multiple proc smaps entries', () => {
    const smaps = [
      '00400000-00401000 r-xp 00000000 00:00 0',
      'Private_Dirty:\t  128 kB',
      'Private_Clean:\t  1024 kB',
      '00401000-00402000 rw-p 00001000 00:00 0',
      'Private_Dirty:\t  1920 kB',
      '',
    ].join('\n');

    expect(parsePrivateMemoryKB(smaps)).toBe(3072);
    expect(parsePrivateMemoryKB('Name:\tirdashies\n')).toBeUndefined();
  });
});
