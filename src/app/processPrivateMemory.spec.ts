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

  it('reads the same counters from proc status without them being present on every kernel', () => {
    const status = [
      'Name:\tirdashies',
      'VmRSS:\t 100000 kB',
      'Private_Clean:\t  1024 kB',
      'Private_Dirty:\t  2048 kB',
      '',
    ].join('\n');

    expect(parsePrivateMemoryKB(status)).toBe(3072);
    expect(parsePrivateMemoryKB('Name:\tirdashies\n')).toBeUndefined();
  });
});
