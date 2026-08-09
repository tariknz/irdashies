import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWidgetInputRequirements } from './widgetInputMetadata';

describe('widget input metadata', () => {
  it('reads channel requirements from widget runtime definitions', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'irdashies-perf-'));
    const widgetDirectory = path.join(
      root,
      'src/frontend/components/TestWidget'
    );
    await mkdir(widgetDirectory, { recursive: true });
    await writeFile(
      path.join(widgetDirectory, 'widgetRuntimeDefinition.ts'),
      "export default { id: 'test', channels: ['one.snapshot', 'two.snapshot'] };",
      'utf8'
    );

    await expect(readWidgetInputRequirements(root)).resolves.toEqual({
      test: ['one.snapshot', 'two.snapshot'],
    });
  });
});
