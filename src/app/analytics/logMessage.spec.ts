import { describe, expect, it } from 'vitest';
import { createLogPathScrubber } from './logMessage';

describe('analytics log path redaction', () => {
  it('redacts userData before home, including URL-encoded paths and regexp characters', () => {
    const scrub = createLogPathScrubber(
      '/Users/Alice (work)/irDashies',
      '/Users/Alice (work)'
    );
    expect(
      scrub(
        'load /Users/Alice (work)/irDashies/sdk.node at /Users/Alice (work)/src/file.ts'
      )
    ).toBe('load <userData>/sdk.node at <home>/src/file.ts');
    expect(scrub('file:///Users/Alice%20(work)/irDashies/main.js')).toBe(
      'file://<userData>/main.js'
    );
  });

  it('redacts Windows paths case-insensitively with either slash style', () => {
    const scrub = createLogPathScrubber(
      'C:\\Users\\Alice\\AppData\\Roaming\\irdashies',
      'C:\\Users\\Alice'
    );
    expect(
      scrub(
        'c:\\users\\alice\\AppData\\Roaming\\irdashies\\sdk.node C:/Users/Alice/source.ts'
      )
    ).toBe('<userData>\\sdk.node <home>/source.ts');
    expect(
      scrub(JSON.stringify({ file: 'C:\\Users\\Alice\\secret.json' }))
    ).not.toContain('Alice');
  });

  it('ignores empty and root prefixes', () => {
    expect(createLogPathScrubber('', '/')('/module/file.ts')).toBe(
      '/module/file.ts'
    );
  });
});
