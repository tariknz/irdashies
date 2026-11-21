import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { PlusIcon } from '@phosphor-icons/react';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SingleFuelWidgetSettings } from './SingleFuelWidgetSettings';
import { generateId } from './utils';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';

const widgetType = 'fuel';
const defaultConfig = getWidgetDefaultConfig('fuel');

interface FuelSettingsProps {
  widgetId?: string;
}

export const FuelSettings = ({ widgetId }: FuelSettingsProps) => {
  const sharedPreview = useContext(SettingsPreviewContext);
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();

  const fuelWidgets =
    currentDashboard?.widgets.filter((w) => (w.type || w.id) === widgetType) ||
    [];

  const handleAddWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;

    const newId = `${widgetType}-${generateId()}`;
    const newWidget = {
      id: newId,
      type: widgetType,
      enabled: true,
      layout: { x: 50, y: 50, width: 300, height: 220 },
      config: defaultConfig as unknown as Record<string, unknown>,
    };

    onDashboardUpdated({
      ...currentDashboard,
      widgets: [...currentDashboard.widgets, newWidget],
    });

    navigate(`/settings/${newId}`);
  };

  if (fuelWidgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-200">Fuel Calculator</h3>
        <p className="text-slate-400">No fuel calculator widgets added yet.</p>
        <button
          onClick={handleAddWidget}
          className="flex min-h-9 items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
        >
          <PlusIcon size={20} /> Create New Widget
        </button>
      </div>
    );
  }

  const selectedId = widgetId ?? fuelWidgets[0].id;

  return (
    <div
      className={
        sharedPreview
          ? 'h-full min-h-0 p-1'
          : 'space-y-4 h-full overflow-y-auto p-1'
      }
    >
      <SingleFuelWidgetSettings
        key={selectedId}
        widgetId={selectedId}
        disableInternalScroll={!sharedPreview}
      />
    </div>
  );
};
