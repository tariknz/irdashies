import { useTelemetryValue, useDashboard } from '@irdashies/context';
import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useState, useEffect } from 'react';
import logoSvg from '../../../../docs/assets/icons/logo.svg';

const LOCALSTORAGE_KEY = 'garagecover-image';

export const GarageCover = () => {
    const isInGarage = useTelemetryValue('IsInGarage');
    const settings = useGarageCoverSettings();
    const { bridge } = useDashboard();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const isElectronMode = 'getGarageCoverImageAsDataUrl' in bridge;

    useEffect(() => {
        // Skip loading in Electron mode
        if (isElectronMode) {
            return;
        }

        // Browser mode - fetch from API or localStorage
        if (settings.imageFilename && settings.imageFilename !== 'browser-mode') {
            // Fetch from server API
            fetch(`http://localhost:3000/api/garage-cover-image?filename=${encodeURIComponent(settings.imageFilename)}`)
                .then(res => {
                    if (!res.ok) throw new Error(`API returned ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data.dataUrl) {
                        console.log('[GarageCover] Image loaded:', settings.imageFilename);
                    }
                    setImageUrl(data.dataUrl);
                })
                .catch(() => {
                    // Fallback to localStorage
                    const dataUrl = localStorage.getItem(LOCALSTORAGE_KEY);
                    if (dataUrl) {
                        console.log('[GarageCover] Image loaded from localStorage');
                    }
                    setImageUrl(dataUrl);
                });
        } else {
            // Check localStorage for browser-uploaded images
            const dataUrl = localStorage.getItem(LOCALSTORAGE_KEY);
            if (dataUrl) {
                console.log('[GarageCover] Image loaded from localStorage');
            }
            setTimeout(() => setImageUrl(dataUrl), 0); // force async update
        }
    }, [settings.imageFilename, bridge, isElectronMode]);

    // Only show in browser mode (for streaming), never in Electron
    if (isElectronMode) {
        return <></>;
    }

    if (!isInGarage) {
        return <></>;
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-black">
            <img
                src={imageUrl || logoSvg}
                alt='Garage Cover'
                className="w-full h-full object-contain"
            />
        </div>
    );
};
