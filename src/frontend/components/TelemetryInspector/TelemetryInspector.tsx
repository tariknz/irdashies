import { useTelemetryStore, useDashboard } from '@irdashies/context';
import { useSessionStore } from '../../context/SessionStore/SessionStore';
import { useMemo } from 'react';
import type { DashboardWidget } from '@irdashies/types';

interface TelemetryInspectorConfig {
  background?: { opacity: number };
  properties?: {
    source: 'telemetry' | 'session';
    path: string;
    label?: string;
  }[];
}

const getNestedValue = (obj: unknown, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
};

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(4);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length === 1) return formatValue(value[0]);
    if (value.length <= 5) return `[${value.map(formatValue).join(', ')}]`;
    return `[${value.map(formatValue).join(', ')}... (${value.length} items)]`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

interface PropertyRowProps {
  label: string;
  path: string;
  source: 'telemetry' | 'session';
}

const PropertyRow = ({ label, path, source }: PropertyRowProps) => {
  const telemetry = useTelemetryStore((state) => state.telemetry);
  const session = useSessionStore((state) => state.session);

  const value = useMemo(() => {
    const data = source === 'telemetry' ? telemetry : session;
    const rawValue = getNestedValue(data, path);

    // For telemetry, extract the value array from the TelemetryVariable
    if (
      source === 'telemetry' &&
      rawValue &&
      typeof rawValue === 'object' &&
      'value' in rawValue
    ) {
      return (rawValue as { value: unknown }).value;
    }

    return rawValue;
  }, [source, path, telemetry, session]);

  return (
    <div className="flex justify-between items-center py-0.5 border-b border-slate-700/50 last:border-b-0">
      <span className="text-slate-400 text-xs truncate mr-2" title={path}>
        {label}
      </span>
      <span
        className="text-white text-xs font-mono text-right"
        title={String(value)}
      >
        {formatValue(value)}
      </span>
    </div>
  );
};

export const TelemetryInspector = (config?: TelemetryInspectorConfig) => {
  const { currentDashboard } = useDashboard();
  const widgetConfig = currentDashboard?.widgets?.find(
    (w: DashboardWidget) => w.id === 'telemetryinspector'
  )?.config as TelemetryInspectorConfig | undefined;
  const settings = config ?? widgetConfig;

  const properties = settings?.properties ?? [];

  if (properties.length === 0) {
    return (
      <div
        className="w-full rounded-sm p-2 bg-slate-800/(--bg-opacity)"
        style={{
          ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
        }}
      >
        <div className="text-slate-400 text-xs text-center">
          No properties configured.
          <br />
          Add properties in widget settings.
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-sm p-2 bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <div className="text-slate-300 text-xs font-semibold mb-1 border-b border-slate-600 pb-1">
        Telemetry Inspector
      </div>
      <div className="flex flex-col">
        {properties.map((prop, index) => (
          <PropertyRow
            key={`${prop.source}-${prop.path}-${index}`}
            label={prop.label ?? prop.path}
            path={prop.path}
            source={prop.source}
          />
        ))}
      </div>
    </div>
  );
};
