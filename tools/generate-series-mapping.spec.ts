import { readFileSync, writeFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';
import { generateSeriesMapping } from './generate-series-mapping';

vi.mock('fs', () => {
  const mock = { readFileSync: vi.fn(), writeFileSync: vi.fn() };
  return { ...mock, default: mock };
});
vi.mock('../src/frontend/utils/seriesMapping', () => {
  const mock = { seriesMapping: { '10': 'Retired series', '20': 'Old name' } };
  return { ...mock, default: mock };
});

describe('generateSeriesMapping', () => {
  it('preserves absent IDs, updates names, and inserts new IDs in numeric order', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify([
        { series_id: 30, series_name: 'New series' },
        { series_id: 20, series_name: 'Updated name' },
      ])
    );

    generateSeriesMapping();

    const content = String(vi.mocked(writeFileSync).mock.calls[0][1]);
    expect(content).toContain("'10': 'Retired series'");
    expect(content).toContain("'20': 'Updated name'");
    expect(content).toContain("'30': 'New series'");
    expect(content).not.toContain('Old name');
    expect(content.indexOf("'10'")).toBeLessThan(content.indexOf("'20'"));
    expect(content.indexOf("'20'")).toBeLessThan(content.indexOf("'30'"));
  });
});
