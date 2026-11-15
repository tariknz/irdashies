import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  isIbtInspectorScenario,
  type IbtInspectorScenario,
} from '../../types/ibtInspectorScenario';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';
import logger from '../logger';

/** A single explicitly saved workspace; never auto-starts playback. */
export function createIbtInspectorScenarioStore(directory: string) {
  const filePath = path.join(directory, 'scenario.json');
  let current: IbtInspectorScenario | null = null;
  let writeError: unknown;
  const writer = createDebouncedAtomicWriter({
    filePath,
    serialize: () => JSON.stringify(current),
    onSuccess: () => {
      writeError = undefined;
    },
    onError: (error) => {
      writeError = error;
      logger.warn('[IBT Inspector] Could not save scenario', error);
    },
  });
  return {
    async read(): Promise<IbtInspectorScenario | null> {
      try {
        if ((await stat(filePath)).size > 4096)
          throw new Error('Scenario exceeds size limit');
        const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
        if (!isIbtInspectorScenario(parsed))
          throw new Error('Invalid saved scenario');
        return parsed;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          logger.warn('[IBT Inspector] Could not read scenario', error);
        return null;
      }
    },
    async save(scenario: IbtInspectorScenario) {
      if (!isIbtInspectorScenario(scenario))
        throw new Error('Invalid scenario');
      await mkdir(directory, { recursive: true });
      current = scenario;
      writer.schedule();
      await writer.flush();
      if (writeError) throw writeError;
    },
  };
}
