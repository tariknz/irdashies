import { stat } from 'node:fs/promises';
import path from 'node:path';

export async function assertOutputDistinctFromInputs(
  outputPath: string,
  inputPaths: readonly string[]
): Promise<void> {
  const output = await stat(outputPath, { bigint: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
  );
  for (const inputPath of inputPaths) {
    if (path.resolve(outputPath) !== path.resolve(inputPath)) {
      if (!output) continue;
      const input = await stat(inputPath, { bigint: true });
      if (output.dev !== input.dev || output.ino !== input.ino) continue;
    }
    throw new Error(`Output path would overwrite an input file: ${inputPath}`);
  }
}
