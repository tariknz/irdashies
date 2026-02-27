import { FuelWidgetSettings } from '../../types';
import { DualFontSizeInput } from './FontSizeInputs';

interface WidgetFontSizeSettingsProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const WidgetFontSizeSettings = ({ settings, onChange }: WidgetFontSizeSettingsProps) => {
  return (
    <>
      {/* Widget Styles for Fuel 2 specific components without toggles */}     

      <DualFontSizeInput 
        widgetId="fuelHeader" 
        title="Header" 
        description="Stops, Lap Window, and Confidence level. Adjust Label/Value sizes." 
        settings={settings} 
        onChange={onChange} 
      />

      <DualFontSizeInput 
        widgetId="fuelConfidence" 
        title="Confidence Messages" 
        description="Text warnings when data is reliable/unreliable. Adjust Label/Value sizes." 
        settings={settings} 
        onChange={onChange} 
      />

      <DualFontSizeInput 
        widgetId="fuelGauge" 
        title="Fuel Gauge" 
        description="Visual circular fuel level indicator. Adjust Label/Value sizes." 
        settings={settings} 
        onChange={onChange} 
      />

      <DualFontSizeInput 
        widgetId="fuelTimeEmpty" 
        title="Time Until Empty" 
        description="Estimated driving time remaining. Adjust Label/Value sizes." 
        settings={settings} 
        onChange={onChange} 
      />
      
    </>
  );
};
