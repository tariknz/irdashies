import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PerfComparison } from './analyze.ts';
import { choiceArgument, parseArguments } from './args.ts';
import {
  evaluateBranchRuns,
  branchAggregateMarkdown,
  type SideLabel,
} from './branches.ts';
import { comparisonCheckSatisfied } from './gates.ts';
import { assertOutputDistinctFromInputs } from './outputPath.ts';

export const REPORT_USAGE = `Usage: npm run perf:report -- <summary.json>... [options]
  --output <file>            Write markdown to a file instead of stdout
  --order abba|ab            Label printed in the aggregate (default abba)
  --baseline <sha-prefix>    Choose the baseline commit when summaries are mixed
  --candidate <sha-prefix>   Choose the candidate commit when summaries are mixed
`;

export function parseReportOptions(args: string[]): {
  inputPaths: string[];
  outputPath?: string;
  order: 'abba' | 'ab';
  baselineCommit?: string;
  candidateCommit?: string;
} {
  const parsed = parseArguments(args, {
    usage: REPORT_USAGE,
    values: ['--output', '--order', '--baseline', '--candidate'],
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
    baselineCommit: parsed.value('--baseline'),
    candidateCommit: parsed.value('--candidate'),
  };
}

const isComparison = (value: unknown): value is PerfComparison =>
  typeof value === 'object' &&
  value !== null &&
  'baseline' in value &&
  'candidate' in value;

type ComparisonSummary = PerfComparison['candidate'];

const commitOf = (summary: ComparisonSummary): string => {
  const commit = summary.scenarioMetadata.sourceCommit;
  if (typeof commit !== 'string' || !/^[a-f0-9]{3,64}$/i.test(commit))
    throw new Error(
      `Capture ${summary.runId} is missing source commit provenance.`
    );
  return commit.toLowerCase();
};

export const runReportCli = async (args: string[]): Promise<void> => {
  const options = parseReportOptions(args);
  const comparisons: PerfComparison[] = [];
  for (const inputPath of options.inputPaths) {
    const contents = await fs.readFile(inputPath, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    if (!isComparison(parsed))
      throw new Error(`${inputPath} is not an analyzer comparison.json.`);
    comparisons.push(parsed);
  }
  const commits = [
    ...new Set(
      comparisons.flatMap(({ baseline, candidate }) => [
        commitOf(baseline),
        commitOf(candidate),
      ])
    ),
  ];
  const matchCommit = (prefix: string): string => {
    const matches = commits.filter((commit) => commit.startsWith(prefix));
    if (matches.length !== 1)
      throw new Error(
        `Commit prefix ${prefix} matched ${matches.length} commits: ${commits.join(', ')}.`
      );
    return matches[0];
  };
  const baselineCommit = options.baselineCommit
    ? matchCommit(options.baselineCommit)
    : commits[0];
  const candidateCommit = options.candidateCommit
    ? matchCommit(options.candidateCommit)
    : commits.find((commit) => commit !== baselineCommit);
  if (!candidateCommit || candidateCommit === baselineCommit)
    throw new Error(
      `A combined report needs two distinct commits; found ${commits.join(', ') || 'none'}.`
    );
  const selected = comparisons.filter(({ baseline, candidate }) => {
    const base = commitOf(baseline);
    const head = commitOf(candidate);
    return (
      (base === baselineCommit && head === candidateCommit) ||
      (base === candidateCommit && head === baselineCommit)
    );
  });
  if (selected.length === 0)
    throw new Error('No comparison includes both selected commits.');

  const runs = selected.flatMap(({ baseline, candidate }, cycle) =>
    [baseline, candidate].map((summary, index) => ({
      label: (commitOf(summary) === baselineCommit
        ? 'baseline'
        : 'candidate') as SideLabel,
      cycle,
      position: index + 1,
      runId: summary.runId,
      logPath: '',
      summary,
    }))
  );
  const captureIds = new Set<string>();
  for (const { summary } of runs) {
    const id = JSON.stringify([
      commitOf(summary),
      summary.runId,
      summary.captureOrigin,
    ]);
    if (captureIds.has(id))
      throw new Error(
        `Capture ${summary.runId} appears more than once in the selected comparisons.`
      );
    captureIds.add(id);
  }
  const savedChecks = selected.flatMap(({ checks }) => checks ?? []);
  const missingEvidence = runs.some(({ summary }) => !summary.evidence);
  const evaluation = missingEvidence ? undefined : evaluateBranchRuns(runs, []);
  const incompleteReasons = [
    ...(missingEvidence ? ['Capture evidence is missing.'] : []),
    ...new Set(
      [...savedChecks, ...(evaluation?.checks ?? [])]
        .filter(
          (check) => check.passed === null && !comparisonCheckSatisfied(check)
        )
        .map((check) => check.target)
    ),
  ];
  const aggregate =
    incompleteReasons.length > 0 || !evaluation
      ? { runsPerSide: selected.length, metrics: [], verdict: 'INCONCLUSIVE' }
      : evaluation.aggregate;
  const markdown = [
    '# Order-controlled multi-run report',
    '',
    `- Baseline commit: \`${baselineCommit}\``,
    `- Candidate commit: \`${candidateCommit}\``,
    '',
    branchAggregateMarkdown(aggregate, options.order),
    ...incompleteReasons.map((reason) => `- ${reason}`),
  ].join('\n');
  if (options.outputPath) {
    await assertOutputDistinctFromInputs(
      options.outputPath,
      options.inputPaths
    );
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
