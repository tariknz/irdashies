import { promises as fs } from 'node:fs';
import path from 'node:path';

export type WidgetInputRequirements = Readonly<
  Record<string, readonly string[]>
>;

export async function readWidgetInputRequirements(
  repositoryRoot = process.cwd()
): Promise<WidgetInputRequirements> {
  const componentsDirectory = path.join(
    repositoryRoot,
    'src/frontend/components'
  );
  const entries = await fs.readdir(componentsDirectory, {
    withFileTypes: true,
  });
  const requirements: Record<string, string[]> = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const definitionPath = path.join(
      componentsDirectory,
      entry.name,
      'widgetRuntimeDefinition.ts'
    );
    const source = await fs.readFile(definitionPath, 'utf8').catch(() => '');
    if (!source) continue;
    const id = source.match(/\bid:\s*'([^']+)'/)?.[1];
    if (!id) continue;
    const channelBlock = source.match(/\bchannels:\s*\[([\s\S]*?)\]/)?.[1];
    requirements[id] = channelBlock
      ? [...channelBlock.matchAll(/'([^']+)'/g)].map((match) => match[1])
      : [];
  }

  return requirements;
}
