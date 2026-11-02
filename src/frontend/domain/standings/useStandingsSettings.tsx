import { createContext, useContext, type ReactNode } from 'react';
import { useDashboard } from '@irdashies/context';
import { StandingsWidgetSettings } from '@irdashies/types';

type StandingsConfig = StandingsWidgetSettings['config'];

const StandingsSettingsContext = createContext<StandingsConfig | null>(null);

/**
 * Makes everything below read this config instead of the overlay Standings
 * widget's. Used where Standings renders as a second instance, such as the
 * Gantry.
 */
export const StandingsSettingsProvider = ({
  config,
  children,
}: {
  config: StandingsConfig;
  children: ReactNode;
}) => (
  <StandingsSettingsContext.Provider value={config}>
    {children}
  </StandingsSettingsContext.Provider>
);

export const useStandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const provided = useContext(StandingsSettingsContext);

  if (provided) return provided;

  const standingsSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'standings'
  )?.config;

  return standingsSettings as unknown as StandingsConfig;
};
