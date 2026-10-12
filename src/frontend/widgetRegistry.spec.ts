import { describe, expect, it } from 'vitest';
import {
  WIDGET_MANIFESTS,
  WIDGET_ORDER,
  getWidgetManifest,
} from '@irdashies/types';
import { WIDGET_MAP, getWidget } from './WidgetIndex';
import { WIDGET_SETTINGS } from './components/Settings/SettingsLoader';

const runtimeModules = import.meta.glob<{ default: { id: string } }>(
  './components/*/widgetRuntimeDefinition.ts',
  { eager: true }
);
const widgetModules = import.meta.glob<{
  default: { id: string } | readonly { id: string }[];
}>('./components/*/widget.ts', { eager: true });
const widgetSources = import.meta.glob<string>('./components/*/widget.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const sorted = (ids: string[]) => [...ids].sort();

describe('widget registry', () => {
  const manifestIds = sorted(WIDGET_MANIFESTS.map((m) => m.id));

  it('has unique manifest ids', () => {
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
  });

  it('keeps manifests, components, settings and runtime definitions in sync', () => {
    expect(sorted(Object.keys(WIDGET_MAP))).toEqual(manifestIds);
    // Telemetry Inspector's settings live on the Advanced page.
    expect(sorted(Object.keys(WIDGET_SETTINGS))).toEqual(
      manifestIds.filter((id) => id !== 'telemetryinspector')
    );
    expect(
      sorted(Object.values(runtimeModules).map((m) => m.default.id))
    ).toEqual(manifestIds);
  });

  it('declares each widget id exactly once across widget.ts files', () => {
    const ids = Object.values(widgetModules).flatMap(({ default: m }) =>
      (Array.isArray(m) ? m : [m]).map((w) => w.id)
    );
    expect(sorted(ids)).toEqual(manifestIds);
  });

  it('keeps widget.ts files from importing other widget folders (N3)', () => {
    for (const [path, source] of Object.entries(widgetSources)) {
      const folder = path.split('/')[2];
      // Static and dynamic imports, either quote style.
      const specifiers = [
        ...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g),
      ].map((m) => m[1]);
      const crossImports = specifiers.filter((spec) => {
        const aliased = spec.match(/^@irdashies\/components\/([^/]+)/);
        if (aliased) return aliased[1] !== folder;
        const sibling = spec.match(/^\.\.\/([^./][^/]*)/);
        return !!sibling && sibling[1] !== folder;
      });
      // '../../WidgetIndex' (a parent, not a sibling folder) is allowed.
      expect(crossImports, path).toEqual([]);
    }
  });

  it('lists only real widget ids in WIDGET_ORDER', () => {
    expect(WIDGET_ORDER.filter((id) => !manifestIds.includes(id))).toEqual([]);
  });

  it('ignores prototype keys', () => {
    expect(getWidgetManifest('__proto__')).toBeUndefined();
    expect(getWidget('toString')).toBeUndefined();
  });
});
