import { useCallback, useState } from 'react';
import logger from '@irdashies/utils/logger';

/** Which docked panels are collapsed. A UI preference, not dashboard config. */
const STORAGE_KEY = 'gantryDockCollapsed';

const readCollapsed = (): ReadonlySet<string> => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]'
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : []
    );
  } catch (error) {
    logger.warn('Ignoring unreadable docked panel state', error);
    return new Set();
  }
};

const writeCollapsed = (ids: ReadonlySet<string>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch (error) {
    logger.warn('Could not remember docked panel state', error);
  }
};

export const useDockCollapsed = () => {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = useCallback((panelId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      writeCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
};
