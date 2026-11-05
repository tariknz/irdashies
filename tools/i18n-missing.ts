import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ruTranslator } from '../src/frontend/components/Settings/i18n/dictionary';
import { normalizeText } from '../src/frontend/components/Settings/i18n/domTranslator';
import { KEEP_AS_IS } from '../src/frontend/components/Settings/i18n/ru/keepAsIs';

export interface Candidate {
  text: string;
  index: number;
}

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const LATIN = /[A-Za-z]/;

const DEFAULT_TARGETS = [
  'src/frontend/components/Settings',
  'src/frontend/components/SortableList',
  'src/types/widgets',
  'src/types/simulators.ts',
  'src/types/simWidgetSupport.ts',
];

const CODE_LIKE = /[;=|&]|^\s*[\w$]+(?:\.[\w$]+)+\s*$/;
const JSX_TEXT = />([^<>{}]*[A-Za-z][^<>{}]*)</g;
const PROP_LITERAL =
  /(?<![\w-])(?:title|description|label|placeholder|aria-label|alt|name|menuLabel|units|text)['"]?\s*[:=]\s*\{?\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
const DIALOG_LITERAL =
  /\b(?:alert|confirm)\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

export const extractCandidates = (source: string): Candidate[] => {
  const found: Candidate[] = [];
  const add = (raw: string, index: number) => {
    const text = normalizeText(raw);
    if (LATIN.test(text)) found.push({ text, index });
  };
  for (const m of source.matchAll(JSX_TEXT)) {
    // Skip code that merely sits between angle brackets (generics, arrows).
    if (!CODE_LIKE.test(m[1])) add(m[1], m.index + 1);
  }
  for (const m of source.matchAll(PROP_LITERAL)) add(m[2], m.index);
  for (const m of source.matchAll(DIALOG_LITERAL)) add(m[2], m.index);
  return found.sort((a, b) => a.index - b.index);
};

export const extractCandidateStrings = (source: string): string[] => [
  ...new Set(extractCandidates(source).map((c) => c.text)),
];

export const isMissing = (text: string): boolean =>
  LATIN.test(text) &&
  ruTranslator.translateText(text) === undefined &&
  !KEEP_AS_IS.has(normalizeText(text));

const isScannable = (file: string): boolean => {
  const posix = file.split(path.sep).join('/');
  return (
    /\.tsx?$/.test(posix) &&
    !/\.(spec|stories)\./.test(posix) &&
    !posix.split('/').includes('i18n')
  );
};

const collectFiles = async (target: string): Promise<string[]> => {
  const absolute = path.resolve(REPO_ROOT, target);
  const info = await stat(absolute);
  if (!info.isDirectory()) return isScannable(absolute) ? [absolute] : [];
  const entries = await readdir(absolute, { recursive: true });
  return entries
    .map((entry) => path.join(absolute, entry))
    .filter(isScannable)
    .sort();
};

const lineOf = (source: string, index: number): number => {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++;
  return line;
};

export const findMissing = async (targets: string[]): Promise<string[]> => {
  const files = new Set<string>();
  for (const target of targets) {
    for (const file of await collectFiles(target)) files.add(file);
  }
  const lines: string[] = [];
  for (const file of [...files].sort()) {
    const source = await readFile(file, 'utf8');
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    for (const { text, index } of extractCandidates(source)) {
      if (isMissing(text)) {
        lines.push(`${relative}: ${lineOf(source, index)}: ${text}`);
      }
    }
  }
  return lines;
};

const main = async () => {
  const args = process.argv.slice(2);
  const lines = await findMissing(args.length ? args : DEFAULT_TARGETS);
  for (const line of lines) console.log(line);
  console.log(`${lines.length} missing`);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
