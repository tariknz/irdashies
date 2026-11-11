import { useId, useRef } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';
import { normalizeWidgetScale, WIDGET_SCALE } from '@irdashies/types';

interface WidgetScaleSettingsProps {
  widgetId: string;
  separated?: boolean;
}

export const WidgetScaleSettings = ({
  widgetId,
  separated = false,
}: WidgetScaleSettingsProps) => {
  const id = useId();
  const sliderRef = useRef<HTMLInputElement>(null);
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
      role="group"
      aria-labelledby={`${id}-label`}
      className={`@container ${separated ? 'border-b border-slate-700 pb-3' : ''}`}
    >
      <div className="grid min-h-9 max-w-xl grid-cols-[minmax(0,1fr)_3rem_5rem] items-center gap-x-3 gap-y-2 @min-[24rem]:grid-cols-[7rem_minmax(0,1fr)_3rem_5rem]">
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="col-span-3 text-md text-slate-300 @min-[24rem]:col-span-1"
          title="Scale this widget's content within its layout."
        >
          Widget Scale
        </label>
        <input
          id={id}
          ref={sliderRef}
          type="range"
          className="h-6 w-full min-w-0 cursor-pointer accent-accent-400"
          value={scale}
          min={WIDGET_SCALE.min}
          max={WIDGET_SCALE.max}
          step={WIDGET_SCALE.step}
          aria-valuetext={`${scale}%`}
          onChange={(event) => setScale(Number(event.target.value))}
        />
        <output
          htmlFor={id}
          className="text-right text-sm tabular-nums text-slate-300"
        >
          {scale}%
        </output>
        <button
          type="button"
          title={
            scale === WIDGET_SCALE.default
              ? 'Scale is already 100%'
              : 'Reset scale to 100%'
          }
          aria-label="Reset scale to 100%"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-200 disabled:cursor-default disabled:text-slate-500 disabled:hover:bg-transparent disabled:hover:text-slate-500"
          disabled={scale === WIDGET_SCALE.default}
          onClick={() => {
            setScale(WIDGET_SCALE.default);
            sliderRef.current?.focus();
          }}
        >
          <ArrowCounterClockwiseIcon size={16} aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
