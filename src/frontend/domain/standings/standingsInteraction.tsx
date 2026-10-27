import { createContext, useContext } from 'react';

export interface StandingsInteraction {
  /** When set, standings rows can be clicked to pick a car. */
  onSelectCar?: (carIdx: number) => void;
  /** The car to mark in the list; every other row is dimmed. */
  highlightedCarIdx?: number | null;
}

const NO_INTERACTION: StandingsInteraction = {};

const StandingsInteractionContext =
  createContext<StandingsInteraction>(NO_INTERACTION);

/**
 * Lets a host make Standings interactive. Without a provider rows are plain,
 * which is how the overlay renders them.
 */
export const StandingsInteractionProvider =
  StandingsInteractionContext.Provider;

export const useStandingsInteraction = () =>
  useContext(StandingsInteractionContext);
