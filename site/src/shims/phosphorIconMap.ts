import {
  StarIcon,
  TwitchLogoIcon,
  WarningIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import type { PhosphorIconEntry } from '@irdashies/utils/phosphorIconMap';

// The site has no custom driver-tag editor. Ship only the preset icons rather
// than the app's complete catalog and search metadata in every demo download.
export const PHOSPHOR_ICON_ENTRIES: PhosphorIconEntry[] = [
  { name: 'Star', component: StarIcon, tags: [] },
  { name: 'TwitchLogo', component: TwitchLogoIcon, tags: [] },
  { name: 'Warning', component: WarningIcon, tags: [] },
  { name: 'YoutubeLogo', component: YoutubeLogoIcon, tags: [] },
];

export const PHOSPHOR_ICON_MAP = new Map(
  PHOSPHOR_ICON_ENTRIES.map(({ name, component }) => [name, component])
);
