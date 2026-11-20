export interface ArgumentSchema {
  usage: string;
  values?: readonly string[];
  booleans?: readonly string[];
  positional?: 'none' | 'one' | 'many';
}

export interface ParsedArguments {
  values: Map<string, string>;
  booleans: Set<string>;
  positionals: string[];
  has: (flag: string) => boolean;
  value: (flag: string) => string | undefined;
  flag: (flag: string) => boolean;
}

const isValueFlag = (schema: ArgumentSchema, token: string): boolean =>
  (schema.values ?? []).includes(token) || (schema.booleans ?? []).includes(token);

export function parseArguments(
  args: readonly string[],
  schema: ArgumentSchema
): ParsedArguments {
  const values = new Map<string, string>();
  const booleans = new Set<string>();
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const separator = token.indexOf('=');
    const flag = separator >= 0 ? token.slice(0, separator) : token;
    const inlineValue = separator >= 0 ? token.slice(separator + 1) : undefined;
    if (!isValueFlag(schema, flag))
      throw new Error(`Unknown option: ${flag}\n${schema.usage}`);
    if (values.has(flag) || booleans.has(flag))
      throw new Error(`Duplicate option: ${flag}\n${schema.usage}`);

    if ((schema.booleans ?? []).includes(flag)) {
      if (inlineValue !== undefined)
        throw new Error(`Option ${flag} does not take a value\n${schema.usage}`);
      booleans.add(flag);
      continue;
    }

    const next = inlineValue ?? args[index + 1];
    if (next === undefined || next.startsWith('--'))
      throw new Error(`Option ${flag} requires a value.\n${schema.usage}`);
    if (inlineValue === undefined) index++;
    values.set(flag, next);
  }

  const positionalMode = schema.positional ?? 'none';
  if (positionalMode === 'none' && positionals.length > 0)
    throw new Error(`Unexpected argument: ${positionals[0]}\n${schema.usage}`);
  if (positionalMode === 'one' && positionals.length !== 1)
    throw new Error(
      positionals.length === 0
        ? `A positional argument is required\n${schema.usage}`
        : `Unexpected argument: ${positionals[1]}\n${schema.usage}`
    );

  return {
    values,
    booleans,
    positionals,
    has: (flag) => values.has(flag) || booleans.has(flag),
    value: (flag) => values.get(flag),
    flag: (flag) => booleans.has(flag),
  };
}

export function numericArgument(
  parsed: ParsedArguments,
  flag: string,
  fallback: number,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): number {
  const raw = parsed.value(flag);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (
    raw.trim() === '' ||
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    (options.min !== undefined && value < options.min) ||
    (options.max !== undefined && value > options.max)
  )
    throw new Error(`Invalid ${flag}: ${raw}`);
  return value;
}

export function choiceArgument<T extends string>(
  parsed: ParsedArguments,
  flag: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = parsed.value(flag);
  if (raw === undefined) return fallback;
  if (!allowed.includes(raw as T))
    throw new Error(`Invalid ${flag}: ${raw}. Expected ${allowed.join(', ')}.`);
  return raw as T;
}

export function listArgument(
  parsed: ParsedArguments,
  flag: string,
  fallback: readonly string[] = []
): string[] {
  const raw = parsed.value(flag);
  if (raw === undefined) return [...fallback];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const safeName = (value: string): string =>
  value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
