import { WarningIcon, StarIcon, TelevisionIcon } from '@phosphor-icons/react';
import { createElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type IconFactory = (props: { size?: number; className?: string; style?: CSSProperties; color?: string }) => ReactNode;

export const PRESET_DRIVER_TAGS: { id: string; name: string; icon: IconFactory; color: number }[] = [
  { id: 'dangerous', name: 'Dangerous', icon: (props) => createElement(WarningIcon, props), color: 0xff0000 },
  { id: 'friend', name: 'Friend', icon: (props) => createElement(StarIcon, props), color: 0x6ba4ff },
  { id: 'streamer', name: 'Streamer', icon: (props) => createElement(TelevisionIcon, props), color: 0x7c3aed },
];

export const getPresetTag = (id?: string) => {
  if (!id) return undefined;
  return PRESET_DRIVER_TAGS.find((g) => g.id === id);
};
