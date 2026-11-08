import { createContext, type Dispatch, type SetStateAction } from 'react';

/** Selected desktop widget; standalone stories and the site use inline previews. */
export const SettingsPreviewContext = createContext<string | undefined>(
  undefined
);

/** Session-only panel width, shared when navigating between settings pages. */
export const SettingsPreviewPanelContext = createContext<
  [number, Dispatch<SetStateAction<number>>] | undefined
>(undefined);
