import { promises as fs } from 'node:fs';

export const parsePrivateMemoryKB = (content: string): number | undefined => {
  let total = 0;
  let found = false;
  for (const line of content.split('\n')) {
    const match = /^Private_(?:Clean|Dirty):\s+(\d+)\s+kB/.exec(line);
    if (!match) continue;
    total += Number(match[1]);
    found = true;
  }
  return found && Number.isSafeInteger(total) ? total : undefined;
};

export const readProcessPrivateMemoryKB = async (
  pid: number
): Promise<number | undefined> => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  for (const file of ['smaps_rollup', 'status']) {
    try {
      const content = await fs.readFile(`/proc/${pid}/${file}`, 'utf8');
      const kilobytes = parsePrivateMemoryKB(content);
      if (kilobytes !== undefined) return kilobytes;
    } catch {
      continue;
    }
  }
  return undefined;
};
