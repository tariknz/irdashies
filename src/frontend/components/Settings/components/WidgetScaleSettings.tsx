import { useId } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';
import { normalizeWidgetScale, WIDGET_SCALE } from '@irdashies/types';

interface WidgetScaleSettingsProps {
  widgetId: string;
  className?: string;
}

export const WidgetScaleSettings = ({
  widgetId,
  className = '',
}: WidgetScaleSettingsProps) => {
  const id = useId();
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const widget = currentDashboard?.widgets.find((w) => w.id === widgetId);
  if (!currentDashboard || !widget) return null;

  const scale = normalizeWidgetScale(widget.scale);
  const setScale = (value: number) => {
    onDashboardUpdated?.({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        w.id === widgetId ? { ...w, scale: normalizeWidgetScale(value) } : w
      ),
    });
  };

  return (
    <div
      className={`grid min-h-8 grid-cols-[minmax(0,1fr)_minmax(5rem,12rem)_3rem_1.5rem] items-center gap-3 ${className}`}
    >
      <label
        htmlFor={id}
        className="text-sm text-slate-300"
        title="Scale this widget's content within its layout."
      >
        Widget Scale
      </label>
      <input
        id={id}
        type="range"
        className="h-1 w-full cursor-pointer accent-accent-400"
        value={scale}
        min={WIDGET_SCALE.min}
        max={WIDGET_SCALE.max}
        step={WIDGET_SCALE.step}
        aria-valuetext={`${scale}%`}
        onChange={(event) => setScale(Number(event.target.value))}
      />
      <output
        htmlFor={id}
        className="text-right text-sm tabular-nums text-slate-400"
      >
        {scale}%
      </output>
      <button
        type="button"
        title="Reset scale to 100%"
        aria-label="Reset scale to 100%"
        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        disabled={scale === WIDGET_SCALE.default}
        onClick={() => setScale(WIDGET_SCALE.default)}
      >
        <ArrowCounterClockwiseIcon size={14} />
      </button>
    </div>
  );
};
