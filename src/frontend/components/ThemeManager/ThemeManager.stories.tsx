import { Meta } from '@storybook/react-vite';
import { ThemeManager } from './ThemeManager';
import { TelemetryDecorator } from '@irdashies/storybook';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge, DashboardLayout, FontSize, GeneralSettingsType } from '@irdashies/types';
import { useState } from 'react';
import { WIDGET_MAP } from '../../WidgetIndex';
import { defaultDashboard } from '../../../app/storage/defaultDashboard';

const meta: Meta<typeof ThemeManager> = {
  component: ThemeManager,
  decorators: [TelemetryDecorator('/test-data/1763227688917')],
};

export default meta;

const createMockBridge = (
  fontSize: FontSize | undefined,
  setFontSize: (size: FontSize | undefined) => void,
  colorPalette: GeneralSettingsType['colorPalette'],
  setColorPalette: (palette: GeneralSettingsType['colorPalette']) => void,
  widgets: DashboardLayout['widgets'] = []
): DashboardBridge => ({
  reloadDashboard: () => {
    return;
  },
  saveDashboard: (dashboard: DashboardLayout) => {
    setFontSize(dashboard.generalSettings?.fontSize);
    setColorPalette(dashboard.generalSettings?.colorPalette || 'default');
  },
  dashboardUpdated: (callback) => {
    callback({
      widgets,
      generalSettings: { fontSize, colorPalette },
    });
    return () => {
      return;
    };
  },
  onEditModeToggled: (callback) => {
    callback(false);
    return () => {
      return;
    };
  },
  toggleLockOverlays: () => Promise.resolve(true),
  getAppVersion: () => Promise.resolve('0.0.7+mock'),
  resetDashboard: () =>
    Promise.resolve({
      widgets: [],
      generalSettings: { fontSize, colorPalette },
    }),
  toggleDemoMode: () => {
    return;
  },
  onDemoModeChanged: (callback) => {
    callback(false);
    return () => {
      return;
    };
  },
  getCurrentDashboard: () => {
    return null;
  },
  stop: () => {
    return;
  },
});

const FONT_SIZES: FontSize[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
const FONT_SIZE_LABELS: Record<FontSize, string> = {
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
  '2xl': '2X Large',
  '3xl': '3X Large',
};

const COLOR_PALETTES: NonNullable<GeneralSettingsType['colorPalette']>[] = [
  'default',
  'black',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'zinc',
  'stone',
];

const createThemeControls = (
  fontSize: FontSize | undefined,
  colorPalette: GeneralSettingsType['colorPalette'],
  mockBridge: DashboardBridge
) => {
  const currentIndex = fontSize ? FONT_SIZES.indexOf(fontSize) : 1;

  const handleSliderChange = (value: number) => {
    const newSize = FONT_SIZES[value];
    mockBridge.saveDashboard({
      widgets: [],
      generalSettings: { fontSize: newSize, colorPalette },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="fontSize" className="text-[12px] font-medium">
          Font Size: {fontSize ? FONT_SIZE_LABELS[fontSize] : 'Small'}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400">XS</span>
          <input
            id="fontSize"
            type="range"
            min="0"
            max={FONT_SIZES.length - 1}
            value={currentIndex}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] text-gray-400">3XL</span>
        </div>
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
              generalSettings: { fontSize, colorPalette: e.target.value as GeneralSettingsType['colorPalette'] },
            })
          }
          className="px-2 py-1 rounded border text-[12px]"
        >
          {COLOR_PALETTES.map((palette) => (
            <option key={palette} value={palette}>
              {palette.charAt(0).toUpperCase() + palette.slice(1)}
            </option>
          ))}
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
    const [fontSize, setFontSize] = useState<FontSize | undefined>('sm');
    const [colorPalette, setColorPalette] = useState<GeneralSettingsType['colorPalette']>('default');
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
    const [fontSize, setFontSize] = useState<FontSize | undefined>('sm');
    const [colorPalette, setColorPalette] = useState<GeneralSettingsType['colorPalette']>('default');
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
