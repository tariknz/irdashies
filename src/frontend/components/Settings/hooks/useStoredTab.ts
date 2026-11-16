import { useState } from 'react';
import { readLocalSetting, writeLocalSetting } from '../localSetting';

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
