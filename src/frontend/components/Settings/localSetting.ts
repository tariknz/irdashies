/**
 * A settings-window preference kept in local storage, so it survives a
 * restart. Reads and writes never throw: with storage unavailable, a read
 * finds nothing and a write holds for the session only.
 */
export const readLocalSetting = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocalSetting = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: kept for this session only.
  }
};
