import type { SessionVisibilitySettings } from '../widgetConfigs';

/**
 * Describes one widget setting once: what it is, its limits and how it is
 * labelled. Settings UI picks the control from it (see SettingProp) and saved
 * configs are checked against it, instead of each settings page repeating
 * labels, ranges and hand-written type guards.
 */
interface PropertyBase {
  label: string;
  description?: string;
}

export type PropertySpec =
  | (PropertyBase & {
      type: 'number';
      min: number;
      max: number;
      step?: number;
      units?: string;
    })
  | (PropertyBase & {
      type: 'enum';
      options: readonly { value: string | number; label: string }[];
      /** 'buttons' (default) or a dropdown for long option lists. */
      control?: 'buttons' | 'select';
    })
  | (PropertyBase & { type: 'boolean' });

/** Keyed by dotted config path, e.g. `background.opacity`. */
export type PropertySpecs = Readonly<Record<string, PropertySpec>>;

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
  Object.entries(specs).every(([path, spec]) =>
    isValidPropertyValue(spec, getPath(config, path))
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
): PropertySpecs =>
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
