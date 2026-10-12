import {
  CrownIcon,
  SealCheckIcon,
  StarIcon,
  TwitchLogoIcon,
  WrenchIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import type { StreamChatBadge, StreamChatPlatform } from '@irdashies/types';

export const PLATFORM_ICON_COLOR: Record<StreamChatPlatform, string> = {
  twitch: '#a970ff',
  youtube: '#ff0000',
};

interface PlatformIconProps {
  platform: StreamChatPlatform;
  size: number;
}

export const PlatformIcon = ({ platform, size }: PlatformIconProps) => {
  const Icon = platform === 'twitch' ? TwitchLogoIcon : YoutubeLogoIcon;
  return (
    <Icon
      size={size}
      weight="fill"
      color={PLATFORM_ICON_COLOR[platform]}
      aria-label={platform === 'twitch' ? 'Twitch' : 'YouTube'}
      style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
    />
  );
};

const BADGE_COLOR: Record<StreamChatBadge['kind'], string> = {
  owner: '#ffd600',
  moderator: '#5e84f1',
  member: '#2ba640',
  verified: '#aaaaaa',
  other: '#aaaaaa',
};

interface BadgeIconProps {
  badge: StreamChatBadge;
  size: number;
}

const BadgeIcon = ({ badge, size }: BadgeIconProps) => {
  if (badge.imageUrl) {
    return (
      <img
        src={badge.imageUrl}
        alt={badge.label}
        title={badge.label}
        style={{
          height: size,
          width: size,
          display: 'inline',
          verticalAlign: 'middle',
          marginRight: 4,
        }}
      />
    );
  }
  const props = {
    size,
    weight: 'fill' as const,
    color: BADGE_COLOR[badge.kind],
    'aria-label': badge.label,
    style: {
      display: 'inline',
      verticalAlign: 'middle',
      marginRight: 4,
    },
  };
  if (badge.kind === 'owner') return <CrownIcon {...props} />;
  if (badge.kind === 'moderator') return <WrenchIcon {...props} />;
  if (badge.kind === 'verified') return <SealCheckIcon {...props} />;
  return <StarIcon {...props} />;
};

interface MessageHeaderProps {
  platform: StreamChatPlatform;
  badges?: StreamChatBadge[];
  showPlatformIcon: boolean;
  fontSize: number;
}

export const MessageHeader = ({
  platform,
  badges,
  showPlatformIcon,
  fontSize,
}: MessageHeaderProps) => {
  const size = Math.round(fontSize * 1.1);
  return (
    <>
      {showPlatformIcon && <PlatformIcon platform={platform} size={size} />}
      {badges?.map((badge) => (
        <BadgeIcon
          key={`${badge.kind}-${badge.label}`}
          badge={badge}
          size={size}
        />
      ))}
    </>
  );
};
