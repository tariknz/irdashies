import { createContext, useContext, type ReactNode } from 'react';
import {
  getPath,
  getWidgetManifest,
  setPath,
  type PropertySpecs,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { SettingButtonGroupRow } from './SettingButtonGroupRow';
import { SettingSliderRow } from './SettingSliderRow';
import { SettingToggleRow } from './SettingToggleRow';

interface SettingPropsValue {
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

/** One setting row; the control is chosen from the property's manifest spec. */
export const SettingProp = ({ path }: { path: string }) => {
  const ctx = useContext(SettingPropsContext);
  const spec = ctx?.specs[path];
  if (!ctx || !spec) {
    logger.warn('SettingProp: no property spec for', path);
    return null;
  }

  const value = getPath(ctx.config, path) ?? getPath(ctx.defaults, path);
  // handleConfigChange only merges top-level keys, so send the whole
  // top-level branch with this one leaf changed.
  const change = (next: unknown) => {
    const top = path.split('.')[0];
    ctx.onChange({ [top]: setPath(ctx.config, path, next)[top] });
  };

  switch (spec.type) {
    case 'number':
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
      return (
        <SettingButtonGroupRow
          title={spec.label}
          description={spec.description}
          value={value as string}
          options={spec.options.map(({ value, label }) => ({ value, label }))}
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
