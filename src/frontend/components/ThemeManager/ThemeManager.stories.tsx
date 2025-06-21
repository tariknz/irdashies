import { Meta } from '@storybook/react-vite';
import { ThemeManager } from './ThemeManager';
import { TelemetryDecorator } from '@irdashies/storybook';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { useState } from 'react';

const meta: Meta<typeof ThemeManager> = {
  component: ThemeManager,
  decorators: [TelemetryDecorator()],
};

export default meta;

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
    
    const mockBridge: DashboardBridge = {
      reloadDashboard: () => {
        // noop
      },
      saveDashboard: (dashboard: DashboardLayout) => {
        // Update the font size in the dashboard
        setFontSize(dashboard.generalSettings?.fontSize || 'sm');
      },
      dashboardUpdated: (callback) => {
        // Initialize with current font size
        callback({
          widgets: [],
          generalSettings: { fontSize }
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
    };

    const getButtonClass = (size: 'xs' | 'sm' | 'lg' | 'xl') => {
      const baseClass = "px-2 py-1 rounded transition-colors";
      return size === fontSize
        ? `${baseClass} bg-blue-700 text-white`
        : `${baseClass} bg-blue-500 text-white hover:bg-blue-600`;
    };

    return (
      <DashboardProvider bridge={mockBridge}>
        <MemoryRouter initialEntries={['/']}>
          <ThemeManager>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <button 
                  className={getButtonClass('xs')}
                  onClick={() => mockBridge.saveDashboard({ 
                    widgets: [], 
                    generalSettings: { fontSize: 'xs' } 
                  })}
                >
                  Extra Small
                </button>
                <button 
                  className={getButtonClass('sm')}
                  onClick={() => mockBridge.saveDashboard({ 
                    widgets: [], 
                    generalSettings: { fontSize: 'sm' } 
                  })}
                >
                  Small
                </button>
                <button 
                  className={getButtonClass('lg')}
                  onClick={() => mockBridge.saveDashboard({ 
                    widgets: [], 
                    generalSettings: { fontSize: 'lg' } 
                  })}
                >
                  Large
                </button>
                <button 
                  className={getButtonClass('xl')}
                  onClick={() => mockBridge.saveDashboard({ 
                    widgets: [], 
                    generalSettings: { fontSize: 'xl' } 
                  })}
                >
                  Extra Large
                </button>
              </div>
              <div className="space-y-2">
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
