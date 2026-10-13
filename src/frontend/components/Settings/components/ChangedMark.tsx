import type { ReactNode } from 'react';

/**
 * True when `value` differs from `defaults`, looking only at the keys the
 * defaults have. A missing value counts as the default, since saved configs
 * are merged with the defaults on load.
 */
export const differsFromDefault = (
  value: unknown,
  defaults: unknown
): boolean => {
  if (value === undefined) return false;
  if (Array.isArray(defaults)) {
    return JSON.stringify(value) !== JSON.stringify(defaults);
  }
  if (defaults && typeof defaults === 'object') {
    const saved = (value ?? {}) as Record<string, unknown>;
    return Object.entries(defaults).some(([key, fallback]) =>
      differsFromDefault(saved[key], fallback)
    );
  }
  return value !== defaults;
};

/**
 * Radar's changed marker for any settings page: wrap a row with the config
 * keys it edits, and a blue dot shows while any of them differs from the
 * default. Clicking the dot puts them back.
 */
export const changeMarker =
  <T extends object>(
    config: T,
    defaults: T,
    set: (change: Partial<T>) => void
  ) =>
  (keys: (keyof T)[], children: ReactNode) => {
    const changed = keys.some((key) =>
      differsFromDefault(config[key], defaults[key])
    );
    return (
      <div className="relative">
        {changed && (
          <button
            type="button"
            title="Changed: click to reset"
            aria-label={`Reset ${keys.join(', ')}`}
            className="absolute -left-3 top-2 h-2 w-2 rounded-full bg-blue-400 hover:bg-blue-300"
            onClick={() =>
              set(
                Object.fromEntries(
                  keys.map((key) => [key, defaults[key]])
                ) as Partial<T>
              )
            }
          />
        )}
        {children}
      </div>
    );
  };
