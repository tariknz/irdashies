import { FuelWidgetSettings } from '../../types';
import { DualFontSizeInput } from './FontSizeInputs';

interface WidgetFontSizeSettingsProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const WidgetFontSizeSettings = ({
  settings,
  onChange,
}: WidgetFontSizeSettingsProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-200">Widget Settings</h3>

      {/* Widget Styles for Fuel 2 specific components without toggles */}
      <div className="pl-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div>
            <span className="text-sm text-slate-300">Header</span>
            <span className="block text-xs text-slate-500">
              Stops, Lap Window, and Confidence level. Adjust Label/Value sizes.
            </span>
          </div>
          <DualFontSizeInput
            widgetId="fuelHeader"
            settings={settings}
            onChange={onChange}
          />
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/5">
          <div>
            <span className="text-sm text-slate-300">Confidence Messages</span>
            <span className="block text-xs text-slate-500">
              Text warnings when data is reliable/unreliable. Adjust Label/Value
              sizes.
            </span>
          </div>
          <DualFontSizeInput
            widgetId="fuelConfidence"
            settings={settings}
            onChange={onChange}
          />
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/5">
          <div>
            <span className="text-sm text-slate-300">Fuel Gauge</span>
            <span className="block text-xs text-slate-500">
              Visual circular fuel level indicator. Adjust Label/Value sizes.
            </span>
          </div>
          <DualFontSizeInput
            widgetId="fuelGauge"
            settings={settings}
            onChange={onChange}
          />
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/5">
          <div>
            <span className="text-sm text-slate-300">Time Until Empty</span>
            <span className="block text-xs text-slate-500">
              Estimated driving time remaining. Adjust Label/Value sizes.
            </span>
          </div>
          <DualFontSizeInput
            widgetId="fuelTimeEmpty"
            settings={settings}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
};
