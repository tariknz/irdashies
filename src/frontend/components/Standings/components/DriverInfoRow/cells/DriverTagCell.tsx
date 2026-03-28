import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ResolvedDriverTag } from '../../../hooks/useDriverTagMap';
import { colorNumToHex } from '@irdashies/utils/colors';
import { renderDriverIcon } from '@irdashies/utils/driverIcons';

interface DriverTagCellProps {
  tag?: ResolvedDriverTag | null;
  widthPx?: number;
  displayStyle?: 'badge' | 'tag';
  iconWeight?: string;
}

export const DriverTagCell = memo(function DriverTagCell({
  tag,
  widthPx,
  displayStyle = 'badge',
  iconWeight,
}: DriverTagCellProps) {
  const name = tag?.name ?? '';
  const tagThicknessDefault = 6;
  const size = widthPx ?? tagThicknessDefault;

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

  // In badge mode, widthPx ≤ 8 is a legacy tag-bar default — ignore it and
  // use em-based sizing so the icon fills the cell regardless of stale config.
  const badgeWidthPx =
    displayStyle !== 'badge' || (widthPx && widthPx > 8) ? widthPx : undefined;

  const containerStyle = useMemo<CSSProperties | undefined>(() => {
    if (displayStyle === 'tag') return undefined;
    const w = badgeWidthPx ? `${badgeWidthPx}px` : '1.5em';
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: w,
      height: w,
      overflow: 'hidden',
    };
  }, [displayStyle, badgeWidthPx]);

  const imgStyle = useMemo<CSSProperties | undefined>(
    () => ({
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    }),
    []
  );
  const emojiStyle = useMemo<CSSProperties | undefined>(
    () => ({
      fontSize: '24px',
      lineHeight: '24px',
      display: 'inline-block',
    }),
    []
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
        badgeWidthPx ?? 24,
        undefined,
        tag?.color,
        imgStyle,
        emojiStyle,
        iconWeight
      )}
    </span>
  );
});

DriverTagCell.displayName = 'DriverTagCell';

export default DriverTagCell;
