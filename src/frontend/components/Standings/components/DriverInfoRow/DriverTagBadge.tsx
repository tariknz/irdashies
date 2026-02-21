import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ResolvedDriverTag } from './useDriverTag';
import { colorNumToHex } from '@irdashies/utils/colors';
import { renderDriverIcon } from '@irdashies/utils/driverIcons';

interface DriverTagBadgeProps {
  tag?: ResolvedDriverTag | null;
  widthPx?: number;
  displayStyle?: 'badge' | 'tag';
  iconWeight?: string;
}

export const DriverTagBadge = memo(function DriverTagBadge({
  tag,
  widthPx,
  displayStyle = 'badge',
  iconWeight,
}: DriverTagBadgeProps) {
  const name = tag?.name ?? '';
  const defaultBadgeSize = 28;
  const minBadgeSize = 22;
  const tagThicknessDefault = 6;
  const size =
    widthPx ??
    (displayStyle === 'tag' ? tagThicknessDefault : defaultBadgeSize);

  const colorHex = useMemo(() => colorNumToHex(tag?.color), [tag?.color]);

  const tagStyle = useMemo<CSSProperties | undefined>(() => {
    if (displayStyle !== 'tag') return undefined;
    if (!colorHex) return undefined;
    return {
      display: 'inline-block',
      width: size,
      height: 18,
      borderRadius: 2,
      background: colorHex,
      verticalAlign: 'middle',
    };
  }, [displayStyle, size, colorHex]);

  const badgeSize = Math.max(
    displayStyle === 'tag'
      ? tagThicknessDefault
      : (widthPx ?? defaultBadgeSize),
    minBadgeSize
  );

  const containerStyle = useMemo<CSSProperties | undefined>(() => {
    if (displayStyle === 'tag') return undefined;
    return {
      display: 'block',
      width: badgeSize - 4,
      height: badgeSize - 4,
    };
  }, [displayStyle, badgeSize]);

  const imgStyle = useMemo<CSSProperties | undefined>(
    () => ({ display: 'block', height: badgeSize - 4, width: badgeSize - 4 }),
    [badgeSize]
  );
  const emojiStyle = useMemo<CSSProperties | undefined>(
    () => ({
      fontSize: `${badgeSize - 4}px`,
      lineHeight: `${badgeSize}px`,
      display: 'inline-block',
    }),
    [badgeSize]
  );

  if (!tag) return null;

  if (displayStyle === 'tag') {
    if (!tagStyle) return null;
    return (
      <span
        role="img"
        aria-label={`Driver tagged as ${name}`}
        style={tagStyle}
      />
    );
  }

  const icon = tag.icon ?? '';
  if (!icon) return null;

  return (
    <span
      role="img"
      aria-label={`Driver tagged as ${name}`}
      style={containerStyle}
    >
      {renderDriverIcon(
        icon,
        badgeSize - 4,
        undefined,
        tag?.color,
        imgStyle,
        emojiStyle,
        iconWeight
      )}
    </span>
  );
});

DriverTagBadge.displayName = 'DriverTagBadge';

export default DriverTagBadge;
