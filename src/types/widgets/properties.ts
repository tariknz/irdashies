import type { SessionVisibilitySettings } from '../widgetConfigs';

/**
 * Describes one widget setting once: what it is, its limits and how it is
 * labelled. Settings UI picks the control from it (see SettingProp) instead of
 * each settings page repeating labels and ranges. `isConfigValid` checks a
 * saved config against it (Wind uses it to fall back to defaults).
 */
interface PropertyBase {
  label: string;
  description?: string;
}

type NumberSpec =
  | (PropertyBase & {
      type: 'number';
      control?: 'slider';
      min: number;
      max: number;
      step?: number;
      units?: string;
    })
  /** A typed number input; limits are optional. */
  | (PropertyBase & {
      type: 'number';
      control: 'input';
      min?: number;
      max?: number;
      step?: number;
      units?: string;
    });

type EnumSpec<V extends string | number = string | number> = PropertyBase & {
  type: 'enum';
  options: readonly { value: V; label: string }[];
  /** 'buttons' (default) or a dropdown for long option lists. */
  control?: 'buttons' | 'select';
};

type BooleanSpec = PropertyBase & { type: 'boolean' };

export type PropertySpec = NumberSpec | EnumSpec | BooleanSpec;

/** Keyed by dotted config path, e.g. `background.opacity`. */
export type PropertySpecs = Readonly<Record<string, PropertySpec | undefined>>;

type Leaf = string | number | boolean;

/** Dotted paths to the leaf values of a config, e.g. `'background.opacity'`. */
export type ConfigPath<T> = {
  [K in keyof T & string]-?: NonNullable<T[K]> extends Leaf
    ? K
    : NonNullable<T[K]> extends readonly unknown[]
      ? never
      : NonNullable<T[K]> extends object
        ? `${K}.${ConfigPath<NonNullable<T[K]>>}`
        : never;
}[keyof T & string];

/** The value type at a dotted config path. */
export type ConfigPathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? ConfigPathValue<NonNullable<T[K]>, R>
    : never
  : P extends keyof T
    ? NonNullable<T[P]>
    : never;

/** The spec kinds that fit a value: a boolean is a toggle, a string an enum of its values. */
type SpecFor<V> = [V] extends [boolean]
  ? BooleanSpec
  : [V] extends [number]
    ? NumberSpec | EnumSpec<V>
    : [V] extends [string]
      ? EnumSpec<V>
      : never;

/**
 * Specs for one widget's config: TypeScript rejects a path that is not in the
 * config and a spec that does not fit the value at that path.
 */
export type PropertySpecsOf<T> = {
  readonly [P in ConfigPath<T>]?: SpecFor<ConfigPathValue<T, P>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getPath = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined,
      obj
    );

/** Returns a copy of `obj` with `path` set, keeping sibling values. */
export const setPath = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> => {
  const [key, ...rest] = path.split('.');
  if (rest.length === 0) return { ...obj, [key]: value };
  const child = isRecord(obj[key]) ? obj[key] : {};
  return { ...obj, [key]: setPath(child, rest.join('.'), value) };
};

export const isValidPropertyValue = (
  spec: PropertySpec,
  value: unknown
): boolean => {
  switch (spec.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'enum':
      return spec.options.some((option) => option.value === value);
    case 'boolean':
      return typeof value === 'boolean';
  }
};

/** Persisted config is untrusted: every declared property must be valid. */
export const isConfigValid = (specs: PropertySpecs, config: unknown): boolean =>
  isRecord(config) &&
  Object.entries(specs).every(
    ([path, spec]) => !spec || isValidPropertyValue(spec, getPath(config, path))
  );

type SessionKey = keyof SessionVisibilitySettings;

export const SESSION_VISIBILITY_LABELS: Record<SessionKey, string> = {
  race: 'Race',
  loneQualify: 'Lone Qualify',
  openQualify: 'Open Qualify',
  practice: 'Practice',
  offlineTesting: 'Offline Testing',
  warmup: 'Warmup',
};

export const DEFAULT_SESSION_KEYS: readonly SessionKey[] = [
  'race',
  'loneQualify',
  'openQualify',
  'practice',
  'offlineTesting',
];

/** The `sessionVisibility.*` toggles most widgets share. */
export const sessionVisibilityProperties = (
  keys: readonly SessionKey[] = DEFAULT_SESSION_KEYS
): Readonly<Partial<Record<`sessionVisibility.${SessionKey}`, BooleanSpec>>> =>
  Object.fromEntries(
    keys.map((key) => [
      `sessionVisibility.${key}`,
      { type: 'boolean', label: SESSION_VISIBILITY_LABELS[key] },
    ])
  );

/** Numeric enum options `from..to`, labelled with the number. */
export const numberOptions = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    value: from + i,
    label: String(from + i),
  }));
