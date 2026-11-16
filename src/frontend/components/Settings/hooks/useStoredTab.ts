import { useState } from 'react';
import { readLocalSetting, writeLocalSetting } from '../localSetting';

/**
 * The open tab of a settings page, kept so the page opens on it next time.
 * A stored tab the page no longer has falls back to the first.
 */
export const useStoredTab = <Tab extends string>(
  storageKey: string,
  tabs: readonly Tab[]
) => {
  const [tab, setTab] = useState<Tab>(
    () => tabs.find((t) => t === readLocalSetting(storageKey)) ?? tabs[0]
  );
  const selectTab = (next: Tab) => {
    setTab(next);
    writeLocalSetting(storageKey, next);
  };
  return [tab, selectTab] as const;
};
