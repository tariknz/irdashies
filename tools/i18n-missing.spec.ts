import { describe, expect, it } from 'vitest';
import { extractCandidateStrings } from './i18n-missing';

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
