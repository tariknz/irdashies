import { describe, expect, it } from 'vitest';
import {
  createDoctorReport,
  doctorMarkdown,
  parseDoctorOptions,
  summarizeDoctorChecks,
  type DoctorCheck,
} from './doctor';

describe('performance CLI doctor', () => {
  it('defaults to the development target and resolves an optional input path', () => {
    expect(parseDoctorOptions([])).toMatchObject({ target: 'dev' });
    expect(
      parseDoctorOptions(['--target', 'packaged', '--input', 'session.irdt'])
    ).toMatchObject({
      target: 'packaged',
      inputPath: expect.stringMatching(/session\.irdt$/),
    });
  });

  it.each([
    ['--target', 'unknown'],
    ['--target'],
    ['--input'],
    ['--input', 'a.ibt', '--input', 'b.irdt'],
    ['--unknown', 'value'],
  ])('rejects invalid options: %s', (...args) => {
    expect(() => parseDoctorOptions(args)).toThrow();
  });

  it('summarizes failed checks separately from warnings and skipped probes', () => {
    const checks: DoctorCheck[] = [
      { name: 'node', status: 'PASS', detail: 'supported' },
      { name: 'native addon', status: 'FAIL', detail: 'missing' },
      { name: 'source tree', status: 'WARN', detail: 'dirty' },
      { name: 'live simulator', status: 'SKIP', detail: 'not probed' },
    ];
    const report = createDoctorReport('dev', checks);

    expect(report.summary).toEqual({
      passed: 1,
      warnings: 1,
      failed: 1,
      skipped: 1,
    });
    expect(summarizeDoctorChecks(checks)).toEqual(report.summary);
    expect(doctorMarkdown(report)).toContain(
      'Checks are read-only; no application or simulator was launched.'
    );
    expect(doctorMarkdown(report)).toContain(
      '1 passed, 1 warnings, 1 failed, 1 skipped'
    );
  });
});
