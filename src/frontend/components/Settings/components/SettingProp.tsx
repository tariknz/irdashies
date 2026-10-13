import { createContext, useContext, type ReactNode } from 'react';
import {
  getPath,
  getWidgetManifest,
  setPath,
  type ConfigPath,
  type PropertySpecs,
  type WidgetConfigMap,
  type WidgetId,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { SettingButtonGroupRow } from './SettingButtonGroupRow';
import { SettingNumberRow } from './SettingNumberRow';
import { SettingSelectRow } from './SettingSelectRow';
import { SettingSliderRow } from './SettingSliderRow';
import { SettingToggleRow } from './SettingToggleRow';
import { ToggleSwitch } from './ToggleSwitch';

interface SettingPropsValue {
  widget: string;
  specs: PropertySpecs;
  config: Record<string, unknown>;
  defaults: Record<string, unknown>;
  onChange: (update: Record<string, unknown>) => void;
}

const SettingPropsContext = createContext<SettingPropsValue | null>(null);

interface SettingPropsProps<T> {
  /** Widget type whose manifest describes the properties. */
  widget: string;
  config: T;
  /** BaseSettingsSection's handleConfigChange (shallow-merges top-level keys). */
  onChange: (update: Partial<T>) => void;
  children: ReactNode;
}

/** Supplies a settings page's config to the SettingProp rows inside it. */
export const SettingProps = <T extends object>({
  widget,
  config,
  onChange,
  children,
}: SettingPropsProps<T>) => {
  const manifest = getWidgetManifest(widget);
  return (
    <SettingPropsContext.Provider
      value={{
        widget,
        specs: manifest?.properties ?? {},
        config: config as Record<string, unknown>,
        defaults: (manifest?.config ?? {}) as Record<string, unknown>,
        onChange: onChange as (update: Record<string, unknown>) => void,
      }}
    >
      {children}
    </SettingPropsContext.Provider>
  );
};

/** Maps a <select>'s string back to the option's original (maybe numeric) value. */
const fromString = (
  options: readonly { value: string | number }[],
  chosen: string
) => options.find((o) => String(o.value) === chosen)?.value;

const warnedPaths = new Set<string>();

interface SettingPropProps<P extends string = string> {
  path: P;
  /**
   * 'compact' = the inline sub-setting inside a DraggableSettingItem, for
   * toggles and enums. Numbers have no compact control and keep their row.
   */
  variant?: 'row' | 'compact';
}

/**
 * Returns the SettingProp row for one widget, so TypeScript checks every
 * `path` against that widget's config type:
 *
 *   const SettingProp = settingPropFor('wind');
 *   <SettingProp path="background.opacity" />
 */
export const settingPropFor = <K extends WidgetId>(widget: K) => {
  const TypedSettingProp = (
    props: SettingPropProps<ConfigPath<WidgetConfigMap[K]>>
  ) => <SettingPropRow widget={widget} {...props} />;
  return TypedSettingProp;
};

/** One setting row; the control is chosen from the property's manifest spec. */
const SettingPropRow = ({
  widget,
  path,
  variant = 'row',
}: SettingPropProps & { widget: string }) => {
  const ctx = useContext(SettingPropsContext);
  const spec = ctx?.widget === widget ? ctx.specs[path] : undefined;
  if (!ctx || !spec) {
    // Once per widget and path: this runs on every render (e.g. each slider
    // step) and the frontend logger forwards to the main-process log file.
    const key = `${widget}:${path}`;
    if (!warnedPaths.has(key)) {
      warnedPaths.add(key);
      logger.warn('SettingProp: no property spec for', widget, path);
    }
    return null;
  }

  const value = getPath(ctx.config, path) ?? getPath(ctx.defaults, path);
  // handleConfigChange only merges top-level keys, so send the whole
  // top-level branch with this one leaf changed.
  const change = (next: unknown) => {
    const top = path.split('.')[0];
    ctx.onChange({ [top]: setPath(ctx.config, path, next)[top] });
  };

  if (variant === 'compact' && spec.type !== 'number') {
    return (
      <div className="flex items-center justify-between pl-8 mt-2 indent-8">
        <span className="text-sm text-slate-300">{spec.label}</span>
        {spec.type === 'boolean' ? (
          <ToggleSwitch
            enabled={value as boolean}
            onToggle={change}
            ariaLabel={spec.label}
          />
        ) : (
          <select
            value={String(value)}
            onChange={(e) => change(fromString(spec.options, e.target.value))}
            aria-label={spec.label}
            className="bg-slate-700 text-white rounded-md px-2 py-1"
          >
            {spec.options.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  switch (spec.type) {
    case 'number':
      if (spec.control === 'input') {
        return (
          <SettingNumberRow
            title={spec.label}
            description={spec.description}
            value={value as number}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            units={spec.units}
            onChange={change}
          />
        );
      }
      return (
        <SettingSliderRow
          title={spec.label}
          description={spec.description}
          value={value as number}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          units={spec.units}
          onChange={change}
        />
      );
    case 'enum':
      if (spec.control === 'select') {
        return (
          <SettingSelectRow
            title={spec.label}
            description={spec.description}
            value={String(value)}
            options={spec.options.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
            onChange={(v) => change(fromString(spec.options, v))}
          />
        );
      }
      return (
        <SettingButtonGroupRow
          title={spec.label}
          description={spec.description}
          value={value as string}
          options={spec.options.map(({ value, label }) => ({
            value: value as string,
            label,
          }))}
          onChange={change}
        />
      );
    case 'boolean':
      return (
        <SettingToggleRow
          title={spec.label}
          description={spec.description}
          enabled={value as boolean}
          onToggle={change}
        />
      );
  }
};
