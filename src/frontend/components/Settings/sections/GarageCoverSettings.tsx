import { useState, useEffect, useRef } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { GarageCoverWidgetSettings } from '../types';
import { DashboardBridge } from '@irdashies/types';

const SETTING_ID = 'garagecover';
const LOCALSTORAGE_KEY = 'garagecover-image';

const defaultConfig: GarageCoverWidgetSettings['config'] = {
    imageFilename: '',
};

export const GarageCoverSettings = () => {
    const { currentDashboard, bridge } = useDashboard();
    const [settings, setSettings] = useState<GarageCoverWidgetSettings>({
        enabled:
            currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ?? false,
        config:
            (currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.config as
                | GarageCoverWidgetSettings['config']
                | undefined) ?? defaultConfig,
    });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const configChangeHandlerRef = useRef<((newConfig: Partial<GarageCoverWidgetSettings['config']>) => void) | null>(null);
    const hasInitializedRef = useRef(false);

    const loadPreview = (imageFilename: string) => {
        if (!imageFilename) {
            setTimeout(() => setPreviewUrl(null), 0);
            return;
        }

        // Try Electron bridge first
        const dashboardBridge = (window as unknown as { dashboardBridge?: DashboardBridge }).dashboardBridge;
        if (dashboardBridge && 'getGarageCoverImageAsDataUrl' in dashboardBridge) {
            dashboardBridge.getGarageCoverImageAsDataUrl(imageFilename)
                .then((dataUrl: string | null) => {
                    setPreviewUrl(dataUrl);
                })
                .catch(() => {
                    // Fallback to localStorage
                    const dataUrl = localStorage.getItem(LOCALSTORAGE_KEY);
                    setTimeout(() => setPreviewUrl(dataUrl), 0);
                });
        } else {
            // Browser mode - use localStorage
            const dataUrl = localStorage.getItem(LOCALSTORAGE_KEY);
            setTimeout(() => setPreviewUrl(dataUrl), 0);
        }
    };

    // Initialize settings from current dashboard once on mount
    // hasInitializedRef prevents re-initialization if currentDashboard changes
    useEffect(() => {
        if (!currentDashboard || hasInitializedRef.current) return;

        hasInitializedRef.current = true;
        const widget = currentDashboard.widgets.find((w) => w.id === SETTING_ID);
        if (!widget) return;

        const newSettings = {
            enabled: widget.enabled ?? false,
            config: (widget.config as GarageCoverWidgetSettings['config']) || defaultConfig,
        };
        setTimeout(() => setSettings(newSettings), 0);
        // Preview will be loaded by the next effect when settings change
    }, [currentDashboard]);

    // Load preview when imageFilename changes
    useEffect(() => {
        loadPreview(settings.config.imageFilename);
    }, [settings.config.imageFilename]);

    // Helper to update imageFilename in config
    const updateImageFilename = (filename: string) => {
        if (configChangeHandlerRef.current) {
            configChangeHandlerRef.current({ imageFilename: filename });
        } else {
            // Fallback to direct state update
            setSettings(prev => ({
                ...prev,
                config: {
                    ...prev.config,
                    imageFilename: filename,
                },
            }));
        }
    };

    // Common image processing logic
    const processImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result as string;
            const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1]), (c) => c.charCodeAt(0));

            // Call bridge to save image file (Electron only)
            if ('saveGarageCoverImage' in bridge) {
                (bridge.saveGarageCoverImage as (buffer: Uint8Array) => Promise<string>)(imageBuffer)
                    .then((filePath) => {
                        // Extract just the filename from the path
                        const filename = filePath.split(/[\\/]/).pop() || '';
                        updateImageFilename(filename);
                    })
                    .catch(() => {
                        // Still save to localStorage as fallback
                        localStorage.setItem(LOCALSTORAGE_KEY, imageData);
                        updateImageFilename('browser-mode');
                    });
            } else {
                // Browser mode - save to localStorage
                localStorage.setItem(LOCALSTORAGE_KEY, imageData);
                updateImageFilename('browser-mode');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                processImageFile(file);
            }
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processImageFile(files[0]);
        }
    };

    if (!currentDashboard) {
        return <>Loading...</>;
    }

    return (
        <BaseSettingsSection
            title="Garage Cover"
            description="Configure settings for the garage cover widget that displays when in the garage."
            settings={settings}
            onSettingsChange={setSettings}
            widgetId={SETTING_ID}
        >
            {(handleConfigChange) => {
                // Store the handleConfigChange from BaseSettingsSection for use in async callbacks
                configChangeHandlerRef.current = handleConfigChange;

                return (
                    <div className="space-y-4">
                        {/* Info Banner */}
                        <div className="bg-blue-900/30 border border-blue-700/50 rounded-md p-4 space-y-2">
                            <p className="text-sm text-slate-300">
                                <strong>Note:</strong> The garage cover is intended for use whilst streaming. 
                                It only appears when you have the garage window open in iRacing.
                            </p>
                            <p className="text-sm text-slate-300">
                                <strong>Browser Source URL:</strong> <code className="bg-slate-800 px-2 py-1 rounded">http://localhost:3000/component/garagecover</code>
                            </p>
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <label className="text-slate-300">Garage Image</label>
                            <div
                                onDrop={handleImageDrop}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                className="w-full border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-slate-500 transition-colors"
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleImageSelect(e)}
                                    className="hidden"
                                    id="garage-image-input"
                                />
                                <label htmlFor="garage-image-input" className="block cursor-pointer">
                                    {previewUrl ? (
                                        <div className="text-slate-300">
                                            <img
                                                src={previewUrl}
                                                alt="Garage preview"
                                                className="max-h-32 mx-auto mb-2 rounded"
                                            />
                                            <p className="text-sm">Click or drag to replace image</p>
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
                                        localStorage.removeItem(LOCALSTORAGE_KEY);
                                        handleConfigChange({ imageFilename: '' });
                                    }}
                                    className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-slate-200 rounded transition-colors"
                                >
                                    Remove Image
                                </button>
                            )}
                        </div>
                    </div>
                );
            }}
        </BaseSettingsSection>
    );
};
