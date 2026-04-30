import {
  WarningIcon,
  StarIcon,
  TwitchLogoIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import type { IconWeight } from '@phosphor-icons/react';
import { createElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type IconFactory = (props: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  color?: string;
  weight?: IconWeight;
}) => ReactNode;

export const PRESET_DRIVER_TAGS: {
  id: string;
  name: string;
  icon: IconFactory;
  color: number;
}[] = [
  {
    id: 'dangerous',
    name: 'Dangerous',
    icon: (props) => createElement(WarningIcon, props),
    color: 0xff0000,
  },
  {
    id: 'friend',
    name: 'Friend',
    icon: (props) => createElement(StarIcon, props),
    color: 0xffff00,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: (props) => createElement(TwitchLogoIcon, props),
    color: 0x9146ff,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: (props) => createElement(YoutubeLogoIcon, props),
    color: 0xff0000,
  },
];

export const getPresetTag = (id?: string) => {
  if (!id) return undefined;
  return PRESET_DRIVER_TAGS.find((g) => g.id === id);
};
