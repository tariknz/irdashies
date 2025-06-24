import { Meta } from '@storybook/react-vite';
import { ThemeManager } from './ThemeManager';
import { TelemetryDecorator } from '@irdashies/storybook';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { useState } from 'react';
import { WIDGET_MAP } from '../../WidgetIndex';
import { defaultDashboard } from '../../../app/storage/defaultDashboard';

const meta: Meta<typeof ThemeManager> = {
  component: ThemeManager,
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export default meta;

// Helper function to create a mock dashboard bridge
const createMockBridge = (
  fontSize: 'xs' | 'sm' | 'lg' | 'xl',
  setFontSize: (size: 'xs' | 'sm' | 'lg' | 'xl') => void,
  colorPalette: 'default' | string,
  setColorPalette: (palette: 'default' | string) => void,
  widgets: DashboardLayout['widgets'] = []
): DashboardBridge => ({
  reloadDashboard: () => {
    // noop
  },
  saveDashboard: (dashboard: DashboardLayout) => {
    // Update the font size and color palette in the dashboard
    setFontSize(dashboard.generalSettings?.fontSize || 'sm');
    setColorPalette(dashboard.generalSettings?.colorPalette  || 'default');
  },
  dashboardUpdated: (callback) => {
    // Initialize with current font size and color palette
    callback({
      widgets,
      generalSettings: { fontSize, colorPalette },
    });
    return () => {
      // noop
    };
  },
  onEditModeToggled: (callback) => {
    callback(false);
    return () => {
      // noop
    };
  },
  toggleLockOverlays: () => Promise.resolve(true),
  getAppVersion: () => Promise.resolve('0.0.7+mock'),
  resetDashboard: () =>
    Promise.resolve({
      widgets: [],
      generalSettings: { fontSize, colorPalette },
    }),
});

// Helper function to create theme controls (font size buttons and color palette dropdown)
const createThemeControls = (
  fontSize: 'xs' | 'sm' | 'lg' | 'xl',
  colorPalette: 'default' | string,
  mockBridge: DashboardBridge
) => {
  const getButtonClass = (size: 'xs' | 'sm' | 'lg' | 'xl') => {
    const baseClass = 'px-2 py-1 rounded transition-colors';
    return size === fontSize
      ? `${baseClass} bg-blue-700 text-white`
      : `${baseClass} bg-blue-500 text-white hover:bg-blue-600`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          className={getButtonClass('xs')}
          onClick={() =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: { fontSize: 'xs', colorPalette },
            })
          }
        >
          Extra Small
        </button>
        <button
          className={getButtonClass('sm')}
          onClick={() =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: { fontSize: 'sm', colorPalette },
            })
          }
        >
          Small
        </button>
        <button
          className={getButtonClass('lg')}
          onClick={() =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: { fontSize: 'lg', colorPalette },
            })
          }
        >
          Large
        </button>
        <button
          className={getButtonClass('xl')}
          onClick={() =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: { fontSize: 'xl', colorPalette },
            })
          }
        >
          Extra Large
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="colorPalette" className="text-[12px]">
          Color Palette:
        </label>
        <select
          id="colorPalette"
          value={colorPalette}
          onChange={(e) =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: { fontSize, colorPalette: e.target.value as 'default' | string },
            })
          }
          className="px-2 py-1 rounded border text-[12px]"
        >
          <option value="default">Default</option>
          <option value="black">Black</option>
        </select>
      </div>
    </div>
  );
};

export const Primary = {
  render: () => {
    return (
      <MemoryRouter initialEntries={['/']}>
        <ThemeManager>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <div className="text-xs">text-xs</div>
                  <div className="text-sm">text-sm</div>
                  <div className="text-base">text-base</div>
                  <div className="text-lg">text-lg</div>
                  <div className="text-xl">text-xl</div>
                </>
              }
            ></Route>
          </Routes>
        </ThemeManager>
      </MemoryRouter>
    );
  },
};

export const WithFontSizeControls = {
  render: () => {
    const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'lg' | 'xl'>('sm');
    const [colorPalette, setColorPalette] = useState<'default' | string>('default');
    const mockBridge = createMockBridge(fontSize, setFontSize, colorPalette, setColorPalette);

    return (
      <DashboardProvider bridge={mockBridge}>
        <MemoryRouter initialEntries={['/']}>
          <ThemeManager>
            <div className="p-4 space-y-4">
              {createThemeControls(fontSize, colorPalette, mockBridge)}
              <div className="space-y-2 bg-slate-800/25 rounded-sm p-2">
                <div className="text-xs">This is extra small text</div>
                <div className="text-sm">This is small text</div>
                <div className="text-base">This is base text</div>
                <div className="text-lg">This is large text</div>
                <div className="text-xl">This is extra large text</div>
              </div>
            </div>
          </ThemeManager>
        </MemoryRouter>
      </DashboardProvider>
    );
  },
};

export const WithAllAvailableWidgets = {
  render: () => {
    const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'lg' | 'xl'>('sm');
    const [colorPalette, setColorPalette] = useState<'default' | string>('default');
    const mockBridge = createMockBridge(fontSize, setFontSize, colorPalette, setColorPalette, defaultDashboard.widgets);

    return (
      <DashboardProvider bridge={mockBridge}>
        <MemoryRouter initialEntries={['/']}>
          <ThemeManager>
            <div className="p-4 space-y-4">
              {createThemeControls(fontSize, colorPalette, mockBridge)}
            </div>
            <hr className="my-4" />
            <Routes>
              <Route
                path="/"
                element={
                  <div>
                    {Object.entries(WIDGET_MAP).map(([key, Widget]) => (
                      <div key={key}>
                        <h2 className="text-md font-bold m-2 uppercase">{key}</h2>
                        <div className="min-h-24 pb-12">
                          <Widget />
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />
            </Routes>
          </ThemeManager>
        </MemoryRouter>
      </DashboardProvider>
    );
  },
};
