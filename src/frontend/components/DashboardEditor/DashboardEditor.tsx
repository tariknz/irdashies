import { useDashboard } from '@irdashies/context';
import { WIDGET_MAP } from '../../WidgetIndex';
import { getWidgetName } from '../../constants/widgetNames';
import { GearIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

export const DashboardEditor = () => {
  const { currentDashboard, currentProfile } = useDashboard();

  const enabledWidgets = currentDashboard?.widgets.filter(w => w.enabled) || [];

  if (!currentDashboard) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-700 shadow-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GearIcon size={24} weight="bold" className="text-blue-400" />
              <h1 className="text-2xl font-bold text-white">Dashboard Preview</h1>
            </div>
            {currentProfile && (
              <div className="text-sm text-gray-400">
                Profile: <span className="text-blue-300 font-medium">{currentProfile.name}</span>
              </div>
            )}
          </div>
          <Link
            to="/settings"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
          >
            Open Settings
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {enabledWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl mb-2">No widgets enabled</div>
            <div className="text-sm mb-6">Enable widgets in Settings to see them here</div>
            <Link
              to="/settings"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h2 className="text-blue-300 font-semibold mb-2">💡 About Dashboard Editing</h2>
              <p className="text-sm text-blue-200">
                In the Electron app, press <kbd className="px-2 py-1 bg-blue-900 rounded text-xs">F6</kbd> to enable 
                Edit Mode. Each widget opens in a separate window that you can drag, resize, and position. 
                In this browser view, widgets are shown in a grid layout.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {enabledWidgets.map((widget) => {
                const ComponentFn = WIDGET_MAP[widget.id.toLowerCase()];
                const widgetName = getWidgetName(widget.id);
                
                if (!ComponentFn) {
                  return (
                    <div
                      key={widget.id}
                      className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 flex items-center justify-center text-white"
                    >
                      Widget not found: {widget.id}
                    </div>
                  );
                }

                return (
                  <div
                    key={widget.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-700 px-4 py-2 border-b border-slate-600">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">{widgetName}</h3>
                        <span className="text-xs text-gray-400">
                          {widget.layout.width} × {widget.layout.height}
                        </span>
                      </div>
                    </div>
                    <div 
                      className="p-4"
                      style={{
                        minHeight: Math.min(widget.layout.height, 400),
                        maxHeight: 500,
                        overflow: 'auto'
                      }}
                    >
                      <ComponentFn {...(widget.config || {})} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
