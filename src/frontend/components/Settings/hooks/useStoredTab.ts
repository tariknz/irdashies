import { useEffect, useState } from 'react';
import { readLocalSetting, writeLocalSetting } from '../localSetting';

export const useStoredTab = <Tab extends string>(
  storageKey: string,
  tabs: readonly Tab[]
) => {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = readLocalSetting(storageKey);
    return tabs.find((candidate) => candidate === saved) ?? tabs[0];
  });

  useEffect(() => {
    writeLocalSetting(storageKey, tab);
  }, [storageKey, tab]);

  return [tab, setTab] as const;
};
