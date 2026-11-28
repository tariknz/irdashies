import fs from 'node:fs';
import path from 'node:path';
import {
  exportLmuTrackGeometry,
  unusableExistingBundle,
  type GeometryInput,
  type SectorLogInput,
} from './lmu-track-geometry';

const usage =
  'Usage: npm run lmu:export-geometry -- [<lmu-world-tracks.json>...] [--sectors <main.log>]... [--out <bundle.json>] [--date <yyyy-mm-dd>]';

const args = process.argv.slice(2);
const files: string[] = [];
const sectorFiles: string[] = [];
let outputPath = path.join(
  process.cwd(),
  'src',
  'app',
  'lmu',
  'lmu-track-geometry.json'
);
let createdAt = new Date().toISOString().slice(0, 10);
const valueAfter = (index: number): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`${args[index]} needs a value
${usage}`);
    process.exit(1);
  }
  return value;
};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--out') {
    outputPath = path.resolve(valueAfter(index));
    index += 1;
  } else if (arg === '--date') {
    createdAt = valueAfter(index);
    index += 1;
  } else if (arg === '--sectors') {
    sectorFiles.push(valueAfter(index));
    index += 1;
  } else if (arg.startsWith('--')) {
    console.error(`Unknown option ${arg}
${usage}`);
    process.exit(1);
  } else {
    files.push(arg);
  }
}
if (files.length === 0 && sectorFiles.length === 0) {
  console.error(usage);
  process.exit(1);
}

const readText = (file: string): string | undefined => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`${file}: unreadable (${String(error)})`);
    return undefined;
  }
};

const readJson = (file: string): unknown => {
  const text = readText(file);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.error(`${file}: not JSON (${String(error)})`);
    return undefined;
  }
};

const inputs: GeometryInput[] = files.map((file) => ({
  file: path.basename(file),
  data: readJson(file),
}));
const sectorLogs: SectorLogInput[] = sectorFiles.flatMap((file) => {
  const text = readText(file);
  return text === undefined ? [] : [{ file: path.basename(file), text }];
});
const existing = fs.existsSync(outputPath) ? readJson(outputPath) : undefined;
if (fs.existsSync(outputPath) && existing === undefined) {
  console.error(
    `${outputPath} exists but could not be read; fix or remove it before exporting`
  );
  process.exit(1);
}
const existingProblem = unusableExistingBundle(existing);
if (existingProblem) {
  console.error(
    `${outputPath} ${existingProblem}; left untouched, nothing exported`
  );
  process.exit(1);
}
const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
) as { version?: string };

const result = exportLmuTrackGeometry(inputs, existing, {
  createdAt,
  irdashiesVersion: packageJson.version ?? 'unknown',
  sectorLogs,
});
fs.writeFileSync(outputPath, result.text);
console.log(result.report.join('\n'));
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
