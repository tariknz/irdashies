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

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const LATIN = /[A-Za-z]/;

const DEFAULT_TARGETS = [
  'src/frontend/components',
  'src/frontend/windows',
  'src/frontend/App.tsx',
  'src/frontend/components/Settings',
  'src/frontend/components/SortableList',
  'src/types/widgets',
  'src/types/simulators.ts',
  'src/types/simWidgetSupport.ts',
];

// Code that merely sits between angle brackets (generics, arrows, types).
const CODE_LIKE =
  /(?:^|\s)[\w-]+=(?!=)|^\s*(?:export\s+)?(?:interface|type|class|function)\s|`|\?\?|^\s*(?:catch|switch|if|for|while)\s*\(|^\s*\(|^\s*(?:from\s|[,)=;:!.?])|[(=,]\s*$|^\s*(?:catch|else|finally|try)\s*$|;(?=[\s\S]*(?:['"()=]|\b(?:import|const|let|if|catch|return|function|type|interface)\b))|=>|===|!==|\breadonly\b|\bextends\b|\[\]|\?\s*:|\b(?:const|let|var|return)\s|^\s*[\w$]+(?:\.[\w$]+)+\s*$/;
const JSX_TEXT = /(?<=[>}])([^<>{}]+)(?=[<{])/g;
const PROP_NAME =
  /(?<![\w-])(?:title|description|label|placeholder|aria-label|alt|name|menuLabel|units|text|message)['"]?\s*[:=](?!=)\s*/g;
const DIALOG_LITERAL =
  /\b(?:alert|confirm)\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

const ENTITIES: Record<string, string> = {
  apos: "'",
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1].toLowerCase() === 'x'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? match;
  });

const SIMPLE_ESCAPES: Record<string, string> = {
  n: ' ',
  r: ' ',
  t: ' ',
  b: '',
  f: '',
  v: '',
  '0': '',
};

// Decodes the escape sequences of a JS string literal body (not JSX text).
export const decodeEscapes = (text: string): string =>
  text.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g,
    (_, braced?: string, uni?: string, hex?: string, simple?: string) => {
      const code = braced ?? uni ?? hex;
      if (code !== undefined) {
        const point = parseInt(code, 16);
        return point <= 0x10ffff ? String.fromCodePoint(point) : _;
      }
      if (simple === '\n') return '';
      return SIMPLE_ESCAPES[simple as string] ?? (simple as string);
    }
  );

interface Literal {
  value: string;
  index: number;
}

// Scans a prop/key value expression starting at `start`, returning plain
// string literals. Stops at the end of the expression (a `,` `;` or closing
// bracket at depth 0). A leading `{` is a JSX container and is balanced.
const scanExpression = (source: string, start: number): Literal[] => {
  const literals: Literal[] = [];
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      let hasInterpolation = false;
      while (j < source.length && source[j] !== ch) {
        if (source[j] === '\\') j++;
        else if (ch === '`' && source[j] === '$' && source[j + 1] === '{') {
          hasInterpolation = true;
        } else if (source[j] === '\n' && ch !== '`') break;
        j++;
      }
      if (!hasInterpolation && source[j] === ch) {
        literals.push({ value: source.slice(i + 1, j), index: i });
      }
      i = j + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth < 0) break;
      if (depth === 0 && source[start] === '{') break;
    } else if (depth === 0 && (ch === ',' || ch === ';')) break;
    i++;
  }
  return literals;
};

export const extractCandidates = (source: string): Candidate[] => {
  const found: Candidate[] = [];
  const add = (raw: string, index: number) => {
    const text = normalizeText(raw);
    if (LATIN.test(text)) found.push({ text, index });
  };
  for (const m of source.matchAll(JSX_TEXT)) {
    if (CODE_LIKE.test(m[1])) continue;
    const leading = m[1].length - m[1].trimStart().length;
    add(decodeEntities(m[1]), m.index + leading);
  }
  for (const m of source.matchAll(PROP_NAME)) {
    const start = m.index + m[0].length;
    const literals = scanExpression(source, start);
    // A directly quoted value is just that one literal.
    const direct = /['"`]/.test(source[start] ?? '');
    for (const literal of direct ? literals.slice(0, 1) : literals) {
      // JSX attribute strings are entity-decoded; JS string literals are not.
      const jsxAttribute = direct && m[0].trimEnd().endsWith('=');
      add(
        jsxAttribute
          ? decodeEntities(literal.value)
          : decodeEscapes(literal.value),
        literal.index
      );
    }
  }
  for (const m of source.matchAll(DIALOG_LITERAL))
    add(decodeEscapes(m[2]), m.index);
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
