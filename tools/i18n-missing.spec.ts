import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KEEP_AS_IS } from '../src/frontend/components/Settings/i18n/ru/keepAsIs';
import {
  REPO_ROOT,
  extractCandidateStrings,
  findMissing,
  isMissing,
} from './i18n-missing';

describe('extractCandidateStrings', () => {
  it('collects JSX text and translatable props, ignoring className', () => {
    const source = `<BaseSettingsSection title="Wind" description="Show wind direction and speed.">
  <p>
    Configure general
    settings.
  </p>{x && 'Ignored'}<i className="flex" />`;
    expect(extractCandidateStrings(source)).toEqual([
      'Wind',
      'Show wind direction and speed.',
      'Configure general settings.',
    ]);
  });

  it('collects object literal keys', () => {
    expect(extractCandidateStrings("{ label: 'Background Opacity' }")).toEqual([
      'Background Opacity',
    ]);
  });

  it('collects the first argument of alert and confirm', () => {
    expect(extractCandidateStrings("alert('Invalid JSON format')")).toEqual([
      'Invalid JSON format',
    ]);
    expect(extractCandidateStrings('confirm("Reset all?")')).toEqual([
      'Reset all?',
    ]);
  });

  it('ignores strings without Latin letters', () => {
    expect(extractCandidateStrings("{ label: '42.1' }")).toEqual([]);
  });

  it('returns unique strings', () => {
    expect(
      extractCandidateStrings("{ label: 'Same' }, { title: 'Same' }")
    ).toEqual(['Same']);
  });
});

describe('extractCandidateStrings coverage', () => {
  it('extracts both literals of ternary props', () => {
    expect(
      extractCandidateStrings(
        "<X label={off ? 'Off' : 'On'} title={a ? 'Close search' : `Search ${q}`} />"
      )
    ).toEqual(['Off', 'On', 'Close search']);
  });

  it('extracts ternary literals from object keys', () => {
    expect(
      extractCandidateStrings("{ label: ok ? 'Yes' : 'No', other: 1 }")
    ).toEqual(['Yes', 'No']);
  });

  it('skips template literals with interpolation', () => {
    expect(extractCandidateStrings('<X title={`Input ${id}`} />')).toEqual([]);
  });

  it('keeps plain template literals', () => {
    expect(extractCandidateStrings('{ label: `Plain text` }')).toEqual([
      'Plain text',
    ]);
  });

  it('extracts text around expressions', () => {
    expect(extractCandidateStrings('<b>Reset {name} now</b>')).toEqual([
      'Reset',
      'now',
    ]);
    expect(extractCandidateStrings('<b>{a}Text after</b>')).toEqual([
      'Text after',
    ]);
  });

  it('decodes HTML entities in JSX text', () => {
    expect(
      extractCandidateStrings('<option>Don&apos;t switch</option>')
    ).toEqual(["Don't switch"]);
    expect(extractCandidateStrings('<i>Pit &amp; Fuel</i>')).toEqual([
      'Pit & Fuel',
    ]);
  });

  it('keeps text with & ; = | and drops code-like text', () => {
    expect(extractCandidateStrings('<i>Pit & Fuel</i>')).toEqual([
      'Pit & Fuel',
    ]);
    expect(extractCandidateStrings('<i>A | B</i>')).toEqual(['A | B']);
    expect(extractCandidateStrings('<i>item.level</i>')).toEqual([]);
    expect(extractCandidateStrings('f = (x) => x.length < 3')).toEqual([]);
    expect(extractCandidateStrings('Array<string> = <T>')).toEqual([]);
  });

  it('decodes entities in JSX attribute strings only', () => {
    expect(extractCandidateStrings('<S title="Tires &amp; Aero" />')).toEqual([
      'Tires & Aero',
    ]);
  });

  it('collects message props', () => {
    expect(extractCandidateStrings("{ message: 'Saved' }")).toEqual(['Saved']);
  });
});

describe('isMissing', () => {
  it('is false for translated, keep-as-is and non-Latin strings', () => {
    const [translated] = [...KEEP_AS_IS];
    expect(isMissing(translated)).toBe(false);
    expect(isMissing('  42.1 ')).toBe(false);
    expect(isMissing('Привет')).toBe(false);
  });

  it('is true for unknown Latin strings', () => {
    expect(isMissing('Zzz qqq unknown phrase')).toBe(true);
  });
});

describe('findMissing', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'i18n-missing-'));
    await mkdir(path.join(directory, 'sub', 'i18n'), { recursive: true });
    await writeFile(
      path.join(directory, 'sub', 'A.tsx'),
      "const a = 1;\nconst b = { label: 'Zzz qqq one' };\n<p>\n\n  Zzz qqq two\n</p>\n"
    );
    await writeFile(
      path.join(directory, 'B.ts'),
      "export const x = { title: 'Zzz qqq three' };\n"
    );
    for (const name of [
      'sub/C.spec.ts',
      'sub/D.stories.tsx',
      'sub/i18n/E.ts',
    ]) {
      await writeFile(
        path.join(directory, name),
        "export const y = { title: 'Zzz qqq hidden' };\n"
      );
    }
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('scans directories recursively with exclusions and line numbers', async () => {
    const lines = await findMissing([directory]);
    const rel = (f: string) =>
      path
        .relative(REPO_ROOT, path.join(directory, f))
        .split(path.sep)
        .join('/');
    expect(lines).toEqual([
      `${rel('B.ts')}: 1: Zzz qqq three`,
      `${rel('sub/A.tsx')}: 2: Zzz qqq one`,
      `${rel('sub/A.tsx')}: 5: Zzz qqq two`,
    ]);
  });

  it('accepts file arguments', async () => {
    const lines = await findMissing([path.join(directory, 'B.ts')]);
    expect(lines).toHaveLength(1);
  });
});
