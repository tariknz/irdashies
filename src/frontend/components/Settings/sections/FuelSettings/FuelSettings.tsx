import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { PlusIcon } from '@phosphor-icons/react';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SingleFuelWidgetSettings } from './SingleFuelWidgetSettings';
import { generateId } from './utils';

const widgetType = 'fuel';
const defaultConfig = getWidgetDefaultConfig('fuel');

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
        <SingleFuelWidgetSettings key={selectedId} widgetId={selectedId} />
      )}
    </div>
  );
};
