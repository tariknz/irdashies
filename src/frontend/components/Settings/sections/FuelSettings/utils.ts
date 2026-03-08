export const generateId = () => Math.random().toString(36).substring(2, 9);

export const AVAILABLE_WIDGETS_FUEL: { id: string; label: string }[] = [
  { id: 'fuelHeader', label: 'Header (Stops/Window/Confidence)' },
  { id: 'fuelConfidence', label: 'Confidence Messages' },
  { id: 'fuelGauge', label: 'Fuel Gauge' },
  { id: 'fuelGrid', label: 'Consumption Grid' },
  { id: 'fuelScenarios', label: 'Pit Scenarios' },
  { id: 'fuelTargetMessage', label: 'Target Pit Message' },
  { id: 'fuelGraph', label: 'Fuel History' },
  { id: 'fuelTimeEmpty', label: 'Time Until Empty' },
  { id: 'fuelEconomyPredict', label: 'Economy Predict (Laps vs Target)' },
];
