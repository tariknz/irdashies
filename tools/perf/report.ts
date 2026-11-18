import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PerfComparison } from './analyze.ts';
import { choiceArgument, parseArguments } from './args.ts';
import {
  aggregateBranchRuns,
  branchAggregateMarkdown,
  type SideLabel,
} from './branches.ts';

export const REPORT_USAGE = `Usage: npm run perf:report -- <summary.json>... [options]
  --output <file>            Write markdown to a file instead of stdout
  --order abba|ab            Label printed in the aggregate (default abba)
`;

export function parseReportOptions(args: string[]): {
  inputPaths: string[];
  outputPath?: string;
  order: 'abba' | 'ab';
} {
  const parsed = parseArguments(args, {
    usage: REPORT_USAGE,
    values: ['--output', '--order'],
    positional: 'many',
  });
  if (parsed.positionals.length === 0)
    throw new Error(`At least one summary is required\n${REPORT_USAGE}`);
  return {
    inputPaths: parsed.positionals.map((item) => path.resolve(item)),
    outputPath: parsed.value('--output')
      ? path.resolve(parsed.value('--output') as string)
      : undefined,
    order: choiceArgument(parsed, '--order', ['abba', 'ab'] as const, 'abba'),
  };
}

const isComparison = (value: unknown): value is PerfComparison =>
  typeof value === 'object' &&
  value !== null &&
  'baseline' in value &&
  'candidate' in value;

export const runReportCli = async (args: string[]): Promise<void> => {
  const options = parseReportOptions(args);
  const runs: {
    label: SideLabel;
    cycle: number;
    position: number;
    runId: string;
    logPath: string;
    summary: PerfComparison['candidate'];
  }[] = [];
  let cycle = 0;
  for (const inputPath of options.inputPaths) {
    const contents = await fs.readFile(inputPath, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    if (!isComparison(parsed))
      throw new Error(`${inputPath} is not an analyzer comparison.json.`);
    runs.push(
      {
        label: 'baseline',
        cycle,
        position: 1,
        runId: parsed.baseline.runId,
        logPath: inputPath,
        summary: parsed.baseline,
      },
      {
        label: 'candidate',
        cycle,
        position: 2,
        runId: parsed.candidate.runId,
        logPath: inputPath,
        summary: parsed.candidate,
      }
    );
    cycle++;
  }
  const aggregate = aggregateBranchRuns(runs);
  const markdown = `# Order-controlled multi-run report\n\n${branchAggregateMarkdown(
    aggregate,
    options.order
  )}`;
  if (options.outputPath) {
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.writeFile(options.outputPath, markdown, 'utf8');
    process.stdout.write(`Report: ${options.outputPath}\n`);
  } else {
    process.stdout.write(markdown);
  }
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(REPORT_USAGE);
  } else {
    await runReportCli(args);
  }
}
