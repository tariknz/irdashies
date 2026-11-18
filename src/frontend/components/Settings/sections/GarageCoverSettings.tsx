import { SettingsSection } from '../components/SettingSection';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  GarageCoverWidgetSettings,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { DashboardBridge } from '@irdashies/types';

const SETTING_ID = 'garagecover';
const LOCALSTORAGE_KEY = 'garagecover-image';

const defaultConfig = getWidgetDefaultConfig('garagecover');

export const GarageCoverSettings = () => {
  const { currentDashboard, currentProfile, bridge } = useDashboard();
  const savedWidget = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const settings: GarageCoverWidgetSettings = {
    enabled: savedWidget?.enabled ?? false,
    config:
      (savedWidget?.config as
        GarageCoverWidgetSettings['config'] | undefined) ?? defaultConfig,
  };
  const [serverPort, setServerPort] = useState<number>(3000);
  const [preview, setPreview] = useState<{
    imageFilename: string;
    profileId?: string;
    url: string | null;
  }>();
  const [browserPreview, setBrowserPreview] = useState(() =>
    localStorage.getItem(LOCALSTORAGE_KEY)
  );
  const uploadVersion = useRef(0);
  const profileId = currentProfile?.id;
  const { imageFilename } = settings.config;
  const desktopBridge = (
    window as unknown as { dashboardBridge?: DashboardBridge }
  ).dashboardBridge;
  const useBrowserImage =
    !desktopBridge?.getGarageCoverImageAsDataUrl ||
    imageFilename === 'browser-mode';
  const previewUrl = !imageFilename
    ? null
    : useBrowserImage
      ? browserPreview
      : preview?.imageFilename === imageFilename &&
          preview.profileId === profileId
        ? preview.url
        : null;

  useEffect(() => {
    if (bridge?.getComponentServerPort) {
      bridge.getComponentServerPort().then(setServerPort);
    }
  }, [bridge]);

  useEffect(() => {
    if (!imageFilename || useBrowserImage || !desktopBridge) return;
    let cancelled = false;
    desktopBridge
      .getGarageCoverImageAsDataUrl(imageFilename)
      .catch(() => localStorage.getItem(LOCALSTORAGE_KEY))
      .then((url) => {
        if (!cancelled) setPreview({ imageFilename, profileId, url });
      });
    return () => {
      cancelled = true;
    };
  }, [desktopBridge, imageFilename, profileId, useBrowserImage]);

  useLayoutEffect(
    () => () => {
      uploadVersion.current += 1;
    },
    [imageFilename, profileId]
  );

  const processImageFile = (
    file: File,
    updateImageFilename: (filename: string) => void
  ) => {
    if (!file.type.startsWith('image/')) return;
    const version = ++uploadVersion.current;
    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = reader.result;
      if (version !== uploadVersion.current || typeof imageData !== 'string') {
        return;
      }
      let filename: string | undefined;
      if (bridge.saveGarageCoverImage) {
        try {
          const imageBuffer = Uint8Array.from(
            atob(imageData.split(',')[1]),
            (character) => character.charCodeAt(0)
          );
          const filePath = await bridge.saveGarageCoverImage(imageBuffer);
          filename = filePath.split(/[\\/]/).pop();
        } catch {
          filename = undefined;
        }
      }
      if (version !== uploadVersion.current) return;
      if (!filename) {
        localStorage.setItem(LOCALSTORAGE_KEY, imageData);
        setBrowserPreview(imageData);
      }
      updateImageFilename(filename || 'browser-mode');
    };
    reader.readAsDataURL(file);
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Garage Cover"
      description="Configure settings for the garage cover widget that displays when in the garage."
      settings={settings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const selectImage = (file: File | undefined) => {
          if (file)
            processImageFile(file, (filename) => {
              handleConfigChange({ imageFilename: filename });
            });
        };

        return (
          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-700 rounded-md p-4 space-y-2">
              <p className="text-sm text-slate-300">
                <strong>Note:</strong> The garage cover is intended for use
                whilst streaming. It only appears when you have the garage
                window open in iRacing.
              </p>
              <p className="text-sm text-slate-300">
                <strong>Browser Source URL:</strong>{' '}
                <code className="bg-slate-800 px-2 py-1 rounded">
                  {`http://localhost:${serverPort}/dashboard`}
                </code>
              </p>
            </div>

            <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
              <div className="space-y-2">
                <div className="text-slate-300">Garage Image</div>
                <div
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectImage(event.dataTransfer.files[0]);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="w-full border-2 border-dashed border-settings-boundary rounded-lg p-6 text-center cursor-pointer hover:border-slate-500 focus-within:outline-2 focus-within:outline-accent-300 transition-colors"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => selectImage(event.target.files?.[0])}
                    aria-label="Garage image"
                    className="sr-only"
                    id="garage-image-input"
                  />
                  <label
                    htmlFor="garage-image-input"
                    className="block cursor-pointer"
                  >
                    {previewUrl ? (
                      <div className="text-slate-300">
                        <img
                          src={previewUrl}
                          alt="Garage preview"
                          className="max-h-32 mx-auto mb-2 rounded"
                        />
                        <p className="text-sm">
                          Click or drag to replace image
                        </p>
                      </div>
                    ) : (
                      <div className="text-slate-400">
                        <p className="mb-1">Drag and drop an image here</p>
                        <p className="text-sm">or click to select an image</p>
                      </div>
                    )}
                  </label>
                </div>
                {settings.config.imageFilename && (
                  <button
                    onClick={() => {
                      uploadVersion.current += 1;
                      localStorage.removeItem(LOCALSTORAGE_KEY);
                      setBrowserPreview(null);
                      handleConfigChange({ imageFilename: '' });
                    }}
                    className="settings-button-danger"
                  >
                    Remove Image
                  </button>
                )}
              </div>
            </SettingsSection>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
