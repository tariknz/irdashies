import { Meta } from '@storybook/react-vite';
import { ThemeManager } from './ThemeManager';
import { TelemetryDecorator } from '@irdashies/storybook';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import type {
  DashboardBridge,
  DashboardLayout,
  FontType,
  FontSize,
  GeneralSettingsType,
} from '@irdashies/types';
import { useState } from 'react';
import { WIDGET_MAP } from '../../WidgetIndex';
import { defaultDashboard } from '../../../app/storage/defaultDashboard';

const meta: Meta<typeof ThemeManager> = {
  component: ThemeManager,
  title: 'components/ThemeManager',
  decorators: [TelemetryDecorator('/test-data/1763227688917')],
};

export default meta;

const createMockBridge = (
  fontType: FontType | undefined,
  setFontType: (size: FontType | undefined) => void,
  fontSize: FontSize | undefined,
  setFontSize: (size: FontSize | undefined) => void,
  fontWeight: GeneralSettingsType['fontWeight'],
  setFontWeight: (weight: GeneralSettingsType['fontWeight']) => void,
  colorPalette: GeneralSettingsType['colorPalette'],
  setColorPalette: (palette: GeneralSettingsType['colorPalette']) => void,
  widgets: DashboardLayout['widgets'] = []
): DashboardBridge => ({
  reloadDashboard: () => {
    return;
  },
  saveDashboard: (dashboard: DashboardLayout) => {
    setFontType(dashboard.generalSettings?.fontType || 'lato');
    setFontSize(dashboard.generalSettings?.fontSize || 'sm');
    setColorPalette(dashboard.generalSettings?.colorPalette || 'default');
    setFontWeight(dashboard.generalSettings?.fontWeight || 'normal');
  },
  dashboardUpdated: (callback) => {
    callback(
      {
        widgets,
        generalSettings: { fontType, fontSize, colorPalette, fontWeight },
      },
      undefined
    );
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
      generalSettings: { fontType, fontSize, colorPalette, fontWeight },
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
  getAnalyticsOptOut: () => Promise.resolve(false),
  setAnalyticsOptOut: () => Promise.resolve(),
  stop: () => {
    return;
  },
  saveGarageCoverImage: () => Promise.resolve(''),
  getGarageCoverImageAsDataUrl: () => Promise.resolve(null),
  // Profile management mocks
  listProfiles: () =>
    Promise.resolve([
      {
        id: 'default',
        name: 'Default',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      },
    ]),
  createProfile: (name: string) =>
    Promise.resolve({
      id: 'mock-id',
      name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }),
  deleteProfile: () => Promise.resolve(),
  renameProfile: () => Promise.resolve(),
  switchProfile: () => Promise.resolve(),
  getCurrentProfile: () =>
    Promise.resolve({
      id: 'default',
      name: 'Default',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }),
  updateProfileTheme: async () => undefined,
  getDashboardForProfile: async () => null,
  setAutoStart: () => Promise.resolve(),
});

const FONT_TYPES: FontType[] = [
  'lato',
  'notosans',
  'figtree',
  'inter',
  'roboto',
];
const FONT_SIZES: FontSize[] = [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
];
const FONT_SIZE_LABELS: Record<FontSize, string> = {
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
  '2xl': '2X Large',
  '3xl': '3X Large',
  '4xl': '4X Large',
  '5xl': '5X Large',
  '6xl': '6X Large',
  '7xl': '7X Large',
  '8xl': '8X Large',
  '9xl': '9X Large',
};
const FONT_WEIGHTS: NonNullable<GeneralSettingsType['fontWeight']>[] = [
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
];

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
  fontType: FontType | undefined,
  fontSize: FontSize | undefined,
  colorPalette: GeneralSettingsType['colorPalette'],
  fontWeight: GeneralSettingsType['fontWeight'],
  setFontWeight: (weight: GeneralSettingsType['fontWeight']) => void,
  mockBridge: DashboardBridge
) => {
  const currentIndex = fontSize ? FONT_SIZES.indexOf(fontSize) : 1;

  const handleSliderChange = (value: number) => {
    const newSize = FONT_SIZES[value];
    mockBridge.saveDashboard({
      widgets: [],
      generalSettings: {
        fontType,
        fontSize: newSize,
        colorPalette,
        fontWeight,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Font Size */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fontSize" className="text-[12px] font-medium">
          Font Size: {fontSize ? FONT_SIZE_LABELS[fontSize] : 'Small'}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400">XS</span>
          <input
            id="fontSize"
            type="range"
            min={0}
            max={FONT_SIZES.length - 1}
            value={currentIndex}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] text-gray-400">3XL</span>
        </div>
      </div>

      {/* Color Palette */}
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
              generalSettings: {
                fontType,
                fontSize,
                colorPalette: e.target
                  .value as GeneralSettingsType['colorPalette'],
                fontWeight,
              },
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

      {/* Font */}
      <div className="flex items-center gap-2">
        <label htmlFor="fontType" className="text-[12px]">
          Font:
        </label>
        <select
          id="fontType"
          value={fontType}
          onChange={(e) =>
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: {
                fontType: e.target.value as GeneralSettingsType['fontType'],
                fontSize,
                colorPalette,
                fontWeight,
              },
            })
          }
          className="px-2 py-1 rounded border text-[12px]"
        >
          {FONT_TYPES.map((face) => (
            <option key={face} value={face}>
              {face.charAt(0).toUpperCase() + face.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Font Weight */}
      <div className="flex items-center gap-2">
        <label htmlFor="fontWeight" className="text-[12px]">
          Font Weight:
        </label>
        <select
          id="fontWeight"
          value={fontWeight}
          onChange={(e) => {
            const newWeight = e.target
              .value as GeneralSettingsType['fontWeight'];
            setFontWeight(newWeight);
            mockBridge.saveDashboard({
              widgets: [],
              generalSettings: {
                fontType,
                fontSize,
                colorPalette,
                fontWeight: newWeight,
              },
            });
          }}
          className="px-2 py-1 rounded border text-[12px]"
        >
          {FONT_WEIGHTS.map((weight) => (
            <option key={weight} value={weight}>
              {weight.charAt(0).toUpperCase() + weight.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export const Primary = {
  render: () => (
    <MemoryRouter initialEntries={['/']}>
      <ThemeManager>
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-8">
                {/* Normal text */}
                <div className="space-y-2">
                  <div className="text-xs">text-xs</div>
                  <div className="text-sm">text-sm</div>
                  <div className="text-base">text-base</div>
                  <div className="text-lg">text-lg</div>
                  <div className="text-xl">text-xl</div>
                </div>

                {/* Light text */}
                <div className="space-y-2">
                  <div className="text-xs font-light">text-xs light</div>
                  <div className="text-sm font-light">text-sm light</div>
                  <div className="text-base font-light">text-base light</div>
                  <div className="text-lg font-light">text-lg light</div>
                  <div className="text-xl font-light">text-xl light</div>
                </div>

                {/* Medium text */}
                <div className="space-y-2">
                  <div className="text-xs font-medium">text-xs medium</div>
                  <div className="text-sm font-medium">text-sm medium</div>
                  <div className="text-base font-medium">text-base medium</div>
                  <div className="text-lg font-medium">text-lg medium</div>
                  <div className="text-xl font-medium">text-xl medium</div>
                </div>

                {/* Semibold text */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold">text-xs semibold</div>
                  <div className="text-sm font-semibold">text-sm semibold</div>
                  <div className="text-base font-semibold">
                    text-base semibold
                  </div>
                  <div className="text-lg font-semibold">text-lg semibold</div>
                  <div className="text-xl font-semibold">text-xl semibold</div>
                </div>

                {/* Bold text */}
                <div className="space-y-2">
                  <div className="text-xs font-bold">text-xs bold</div>
                  <div className="text-sm font-bold">text-sm bold</div>
                  <div className="text-base font-bold">text-base bold</div>
                  <div className="text-lg font-bold">text-lg bold</div>
                  <div className="text-xl font-bold">text-xl bold</div>
                </div>

                {/* ExtraBold text */}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold">
                    text-xs extrabold
                  </div>
                  <div className="text-sm font-extrabold">
                    text-sm extrabold
                  </div>
                  <div className="text-base font-extrabold">
                    text-base extrabold
                  </div>
                  <div className="text-lg font-extrabold">
                    text-lg extrabold
                  </div>
                  <div className="text-xl font-extrabold">
                    text-xl extrabold
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </ThemeManager>
    </MemoryRouter>
  ),
};

export const WithFontSizeControls = {
  render: () => {
    const [fontType, setFontType] = useState<FontType | undefined>('lato');
    const [fontSize, setFontSize] = useState<FontSize | undefined>('sm');
    const [colorPalette, setColorPalette] =
      useState<GeneralSettingsType['colorPalette']>('default');
    const [fontWeight, setFontWeight] =
      useState<GeneralSettingsType['fontWeight']>('normal');
    const mockBridge = createMockBridge(
      fontType,
      setFontType,
      fontSize,
      setFontSize,
      fontWeight,
      setFontWeight,
      colorPalette,
      setColorPalette
    );

    return (
      <DashboardProvider bridge={mockBridge}>
        <MemoryRouter initialEntries={['/']}>
          <ThemeManager>
            <div className="p-4 space-y-4">
              {createThemeControls(
                fontType,
                fontSize,
                colorPalette,
                fontWeight,
                setFontWeight,
                mockBridge
              )}
              <div className="space-y-2 bg-slate-800/25 rounded-sm p-2">
                <div className={`text-xs ${fontWeight}`}>
                  This is extra small text
                </div>
                <div className={`text-sm ${fontWeight}`}>
                  This is small text
                </div>
                <div className={`text-base ${fontWeight}`}>
                  This is base text
                </div>
                <div className={`text-lg ${fontWeight}`}>
                  This is large text
                </div>
                <div className={`text-xl ${fontWeight}`}>
                  This is extra large text
                </div>
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
    const [fontType, setFontType] = useState<FontType | undefined>('lato');
    const [fontSize, setFontSize] = useState<FontSize | undefined>('sm');
    const [colorPalette, setColorPalette] =
      useState<GeneralSettingsType['colorPalette']>('default');
    const [fontWeight, setFontWeight] =
      useState<GeneralSettingsType['fontWeight']>('normal');
    const mockBridge = createMockBridge(
      fontType,
      setFontType,
      fontSize,
      setFontSize,
      fontWeight,
      setFontWeight,
      colorPalette,
      setColorPalette,
      defaultDashboard.widgets
    );

    return (
      <DashboardProvider bridge={mockBridge}>
        <MemoryRouter initialEntries={['/']}>
          <ThemeManager>
            <div className="p-4 space-y-4">
              {createThemeControls(
                fontType,
                fontSize,
                colorPalette,
                fontWeight,
                setFontWeight,
                mockBridge
              )}
            </div>
            <hr className="my-4" />
            <Routes>
              <Route
                path="/"
                element={
                  <div>
                    {Object.entries(WIDGET_MAP).map(([key, Widget]) => (
                      <div key={key}>
                        <h2 className="text-md font-bold m-2 uppercase">
                          {key}
                        </h2>
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
