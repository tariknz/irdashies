import { deepMergeConfig, getWidgetManifest } from '@irdashies/types';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';

export function resolvePreviewWidget(
  dashboard: DashboardLayout,
  id: string
): DashboardWidget | undefined {
  const saved = dashboard.widgets.find((widget) => widget.id === id);
  const manifest = getWidgetManifest(saved?.type ?? saved?.id ?? id);
  if (!manifest) return;
  return {
    ...saved,
    id: saved?.id ?? manifest.id,
    type: manifest.id,
    enabled: true,
    layout: saved?.layout ?? manifest.layout,
    config: deepMergeConfig(
      manifest.config as unknown as Record<string, unknown>,
      saved?.config
    ),
  };
}

export function previewFitScale(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number
) {
  if (
    ![width, height, availableWidth, availableHeight].every(
      (value) => Number.isFinite(value) && value > 0
    )
  )
    return 1;
  return Math.min(1, availableWidth / width, availableHeight / height);
}

/** Legacy settings hooks find the type's id; map the selected instance to it. */
export function previewDashboard(
  dashboard: DashboardLayout,
  widget: DashboardWidget
): DashboardLayout {
  const type = widget.type ?? widget.id;
  return {
    ...dashboard,
    widgets: [
      {
        ...widget,
        id: type,
        config: { ...widget.config, sessionVisibility: undefined },
      },
      ...dashboard.widgets.filter(
        (other) => other.id !== widget.id && other.id !== type
      ),
    ],
  };
}
