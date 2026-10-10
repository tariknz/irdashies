import { useState, useEffect, useRef } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TrackMapWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
  DashboardBridge,
} from '@irdashies/types';
import type { SectorDeltaConfig } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { getSectorDeltaThresholdPercentages } from '../../SectorDelta/sectorColorUtils';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';
import {
  dataUrlToBuffer,
  prepareIconForUpload,
} from '../../TrackMap/playerIconUpload';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const SETTING_ID = 'map';
const LOCALSTORAGE_KEY = 'trackmap-player-icon';

const defaultConfig = getWidgetDefaultConfig('map');

export const TrackMapSettings = () => {
  const { currentDashboard, bridge } = useDashboard();

  const sectorDeltaThresholds = (
    currentDashboard?.widgets.find((w) => w.id === 'sectordelta')?.config as
      SectorDeltaConfig | undefined
  )?.thresholds;
  const { green: greenPct, yellow: yellowPct } =
    getSectorDeltaThresholdPercentages(sectorDeltaThresholds);

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TrackMapWidgetSettings | undefined;
  const [settings, setSettings] = useState<TrackMapWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config:
      (savedSettings?.config as TrackMapWidgetSettings['config']) ??
      defaultConfig,
  });

  const [imageError, setImageError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [browserPreviewUrl, setBrowserPreviewUrl] = useState<string | null>(
    () => localStorage.getItem(LOCALSTORAGE_KEY)
  );
  const configChangeHandlerRef = useRef<
    ((newConfig: Partial<TrackMapWidgetSettings['config']>) => void) | null
  >(null);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('trackMapTab') as SettingsTabType) || 'track'
  );

  useEffect(() => {
    localStorage.setItem('trackMapTab', activeTab);
  }, [activeTab]);

  const imageFilename = settings.config.playerIcon?.fileName ?? '';

  const dashboardBridge = (
    window as unknown as { dashboardBridge?: DashboardBridge }
  ).dashboardBridge;
  const hasBridge =
    !!dashboardBridge && 'getPlayerIconImageAsDataUrl' in dashboardBridge;
  const useBrowserMode = imageFilename === 'browser-mode' || !hasBridge;

  // Keyed by filename so that, between an imageFilename change and the new
  // bridge result arriving, we don't briefly show the previous icon.
  const [bridgePreview, setBridgePreview] = useState<{
    filename: string;
    url: string | null;
  } | null>(null);

  const previewUrl = !imageFilename
    ? null
    : useBrowserMode
      ? browserPreviewUrl
      : bridgePreview?.filename === imageFilename
        ? bridgePreview.url
        : null;

  useEffect(() => {
    if (!imageFilename || useBrowserMode || !dashboardBridge) return;

    let cancelled = false;
    dashboardBridge
      .getPlayerIconImageAsDataUrl(imageFilename)
      .then((url: string | null) => {
        if (!cancelled) setBridgePreview({ filename: imageFilename, url });
      })
      .catch(() => {
        if (!cancelled)
          setBridgePreview({
            filename: imageFilename,
            url: localStorage.getItem(LOCALSTORAGE_KEY),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [imageFilename, useBrowserMode, dashboardBridge]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Track Map"
      description="Configure track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="map"
    >
      {(handleConfigChange) => {
        configChangeHandlerRef.current = handleConfigChange;

        const handleIconFile = (file: File) => {
          if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
            setImageError(
              'Unsupported format. Please use PNG, JPG, GIF, WebP or SVG.'
            );
            return;
          }
          setImageError(null);
          const reader = new FileReader();
          reader.onload = async (e) => {
            const originalDataUrl = e.target?.result as string;
            let buffer: Uint8Array;
            let storedDataUrl: string;
            try {
              const prepared = await prepareIconForUpload(
                file,
                originalDataUrl
              );
              buffer = prepared.buffer;
              storedDataUrl = prepared.dataUrl;
            } catch {
              buffer = dataUrlToBuffer(originalDataUrl);
              storedDataUrl = originalDataUrl;
            }

            const fallbackToLocalStorage = () => {
              localStorage.setItem(LOCALSTORAGE_KEY, storedDataUrl);
              setBrowserPreviewUrl(storedDataUrl);
              configChangeHandlerRef.current?.({
                playerIcon: {
                  enabled: settings.config.playerIcon?.enabled ?? false,
                  fileName: 'browser-mode',
                },
              });
            };

            if ('savePlayerIconImage' in bridge) {
              (
                bridge.savePlayerIconImage as (
                  buf: Uint8Array
                ) => Promise<string>
              )(buffer)
                .then((filePath) => {
                  // Empty filePath signals failure (e.g. ws timeout in browser
                  // mode). Treat it the same as a thrown error so we don't
                  // clear the fileName and lose the user's selection.
                  if (!filePath) {
                    fallbackToLocalStorage();
                    return;
                  }
                  const fileName = filePath.split(/[\\/]/).pop() || '';
                  configChangeHandlerRef.current?.({
                    playerIcon: {
                      enabled: settings.config.playerIcon?.enabled ?? false,
                      fileName,
                    },
                  });
                })
                .catch(fallbackToLocalStorage);
            } else {
              fallbackToLocalStorage();
            }
          };
          reader.readAsDataURL(file);
        };

        return (
          <SettingProps
            widget={SETTING_ID}
            config={settings.config}
            onChange={handleConfigChange}
          >
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-slate-700/50">
                <TabButton
                  id="track"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Track
                </TabButton>
                <TabButton
                  id="drivers"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Drivers
                </TabButton>
                <TabButton
                  id="styling"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Styling
                </TabButton>
                <TabButton
                  id="visibility"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Visibility
                </TabButton>
              </div>

              <div>
                {/* TRACK TAB */}
                {activeTab === 'track' && (
                  <SettingsSection title="Track Settings">
                    <SettingProp path="trackLineWidth" />

                    <SettingProp path="trackOutlineWidth" />

                    <SettingProp path="invertTrackColors" />

                    <SettingDivider />

                    <SettingToggleRow
                      title="Sector Colors"
                      description={`Color each sector based on your session performance (purple: session best, green: within ${greenPct}%, yellow: within ${yellowPct}%, red: ${yellowPct}%+ off pace). Thresholds are set in Sector Delta settings.`}
                      enabled={settings.config.sectorColoring?.enabled ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          sectorColoring: {
                            enabled: newValue,
                          },
                        })
                      }
                    />

                    <SettingDivider />

                    <SettingToggleRow
                      title="Enable Turn Labels"
                      description="Show turn numbers and names on the track map"
                      enabled={settings.config.turnLabels?.enabled ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          turnLabels: {
                            ...(settings.config.turnLabels ?? {}),
                            enabled: newValue,
                          },
                        })
                      }
                    />

                    {settings.config.turnLabels?.enabled && (
                      <SettingsSection>
                        <SettingProp path="turnLabels.labelType" />

                        <SettingProp path="turnLabels.highContrast" />

                        <SettingProp path="turnLabels.labelFontSize" />
                      </SettingsSection>
                    )}
                  </SettingsSection>
                )}

                {/* DRIVERS TAB */}
                {activeTab === 'drivers' && (
                  <SettingsSection title="Driver Circles">
                    <SettingToggleRow
                      title="Use custom icon for player"
                      description="Replace the player circle with a custom image"
                      enabled={settings.config.playerIcon?.enabled ?? false}
                      onToggle={(newValue) => {
                        handleConfigChange({
                          playerIcon: {
                            enabled: newValue,
                            fileName:
                              settings.config.playerIcon?.fileName ?? '',
                          },
                        });
                        setShowRemoveConfirm(false);
                        setImageError(null);
                      }}
                    />

                    {(settings.config.playerIcon?.enabled ?? false) && (
                      <div className="ml-4 space-y-2">
                        <div
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleIconFile(file);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="w-full border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-slate-500 transition-colors"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleIconFile(file);
                              e.target.value = '';
                            }}
                            className="hidden"
                            id="player-icon-input"
                          />
                          <label
                            htmlFor="player-icon-input"
                            className="block cursor-pointer"
                          >
                            {previewUrl ? (
                              <div className="flex items-center gap-3">
                                <img
                                  src={previewUrl}
                                  alt="Player icon"
                                  className="w-10 h-10 rounded object-contain bg-slate-700"
                                />
                                <span className="text-sm text-slate-300">
                                  Click or drag to replace icon
                                </span>
                              </div>
                            ) : (
                              <div className="text-slate-400">
                                <p className="mb-1 text-sm">
                                  Drag and drop an image here
                                </p>
                                <p className="text-xs">
                                  or click to select (PNG, JPG, GIF, WebP, SVG)
                                </p>
                              </div>
                            )}
                          </label>
                        </div>

                        {imageError && (
                          <p className="text-sm text-red-400">{imageError}</p>
                        )}

                        {settings.config.playerIcon?.fileName &&
                          (showRemoveConfirm ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-300">
                                Remove icon?
                              </span>
                              <button
                                onClick={() => {
                                  localStorage.removeItem(LOCALSTORAGE_KEY);
                                  setBrowserPreviewUrl(null);
                                  handleConfigChange({
                                    playerIcon: {
                                      enabled:
                                        settings.config.playerIcon?.enabled ??
                                        false,
                                      fileName: '',
                                    },
                                  });
                                  setShowRemoveConfirm(false);
                                }}
                                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              >
                                Yes, remove
                              </button>
                              <button
                                onClick={() => setShowRemoveConfirm(false)}
                                className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRemoveConfirm(true)}
                              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                            >
                              Remove icon
                            </button>
                          ))}
                      </div>
                    )}

                    <SettingDivider />

                    <SettingProp path="showCarNumbers" />

                    {settings.config.showCarNumbers && (
                      <SettingsSection>
                        <SettingButtonGroupRow<
                          'carNumber' | 'sessionPosition' | 'livePosition'
                        >
                          title="Display Mode"
                          value={settings.config.displayMode ?? 'carNumber'}
                          options={[
                            { label: 'Car Number', value: 'carNumber' },
                            {
                              label: 'Session Position',
                              value: 'sessionPosition',
                            },
                            { label: 'Live Position', value: 'livePosition' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({ displayMode: v })
                          }
                        />
                      </SettingsSection>
                    )}

                    <SettingProp path="driverCircleSize" />

                    <SettingProp path="playerCircleSize" />

                    <SettingProp path="trackmapFontSize" />

                    <SettingProp path="useHighlightColor" />

                    <SettingProp path="invertLeaderColor" />
                  </SettingsSection>
                )}

                {/* STYLING TAB */}
                {activeTab === 'styling' && (
                  <SettingsSection title="Minimal Styling">
                    <SettingProp path="styling.isMinimalTrack" />
                    <SettingProp path="styling.isMinimalCar" />
                  </SettingsSection>
                )}

                {/* VISIBILITY TAB */}
                {activeTab === 'visibility' && (
                  <SettingsSection title="Session Visibility">
                    <SessionVisibility
                      sessionVisibility={settings.config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />

                    <SettingDivider />

                    <SettingProp path="showOnlyWhenOnTrack" />
                  </SettingsSection>
                )}
              </div>
            </div>
          </SettingProps>
        );
      }}
    </BaseSettingsSection>
  );
};
