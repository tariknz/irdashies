import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { PlusIcon } from '@phosphor-icons/react';
import { defaultFuelCalculatorSettings } from '../../../FuelCalculator/defaults';
import { SingleFuelWidgetSettings } from './SingleFuelWidgetSettings';
import { generateId } from './utils';

const widgetType = 'fuel';
const defaultConfig = defaultFuelCalculatorSettings;

interface FuelSettingsProps {
  widgetId?: string;
}

export const FuelSettings = ({ widgetId }: FuelSettingsProps) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();

  const fuelWidgets =
    currentDashboard?.widgets.filter((w) => (w.type || w.id) === widgetType) ||
    [];

  const [selectedId, setSelectedId] = useState(() => {
    if (widgetId) return widgetId;
    if (fuelWidgets.length > 0) return fuelWidgets[0].id;
    return '';
  });

  // Track previous widgetId to detect external prop changes
  const [prevWidgetId, setPrevWidgetId] = useState(widgetId);

  // Sync state when prop changes (crucial for URL navigation updates)
  if (widgetId !== prevWidgetId) {
    setPrevWidgetId(widgetId);
    if (widgetId) {
      setSelectedId(widgetId);
    }
  }

  const handleWidgetChange = (newId: string) => {
    setSelectedId(newId);
    navigate(`/settings/${newId}`);
  };

  const handleAddWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;

    // Create new widget ID
    const newId = `${widgetType}-${generateId()}`;
    // Create new widget structure
    const newWidget = {
      id: newId,
      type: widgetType,
      enabled: true,
      layout: { x: 50, y: 50, width: 300, height: 220 }, // Default window size
      config: defaultConfig as unknown as Record<string, unknown>, // Start with default config
    };

    // Update Dashboard
    onDashboardUpdated({
      ...currentDashboard,
      widgets: [...currentDashboard.widgets, newWidget],
    });

    // Select the new widget
    handleWidgetChange(newId);
  };

  const handleDeleteWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;

    const newWidgets = currentDashboard.widgets.filter(
      (w) => w.id !== selectedId
    );

    onDashboardUpdated({
      ...currentDashboard,
      widgets: newWidgets,
    });

    // Reset selection
    const remaining = newWidgets.filter((w) => w.type === widgetType);
    if (remaining.length > 0) handleWidgetChange(remaining[0].id);
    else navigate('/settings/fuel'); // Stay on fuel page but empty state
  };

  // If no widgets and we're in fuel mode, show create button prominently or handle empty state
  if (fuelWidgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-200">Fuel Calculator</h3>
        <p className="text-slate-400">No fuel calculator widgets added yet.</p>
        <button
          onClick={handleAddWidget}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
        >
          <PlusIcon size={20} /> Create New Widget
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full overflow-y-auto p-1">
      {/* Render settings for selected ID */}
      {selectedId && (
        <SingleFuelWidgetSettings
          key={selectedId}
          widgetId={selectedId}
          managerBar={
            <div className="bg-slate-800 p-3 rounded flex items-center justify-between border border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-200">
                  Editing Widget:
                </span>
                <select
                  value={selectedId}
                  onChange={(e) => handleWidgetChange(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white text-sm rounded px-2 py-1"
                >
                  {fuelWidgets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteWidget}
                  disabled={selectedId === 'fuel'}
                  title={
                    selectedId === 'fuel'
                      ? 'Default widget cannot be deleted. Disable it instead.'
                      : 'Delete this layout configuration'
                  }
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    selectedId === 'fuel'
                      ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800'
                  }`}
                >
                  {selectedId === 'fuel' ? 'Default (Locked)' : 'Delete Layout'}
                </button>
                <button
                  onClick={handleAddWidget}
                  className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
                >
                  <PlusIcon /> New Layout
                </button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
};
