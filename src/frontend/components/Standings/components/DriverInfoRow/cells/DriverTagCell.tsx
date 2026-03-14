import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ResolvedDriverTag } from '../useDriverTag';
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

  const containerStyle = useMemo<CSSProperties | undefined>(() => {
    if (displayStyle === 'tag') return undefined;
    return { display: 'block', width: '100%', height: '100%' };
  }, [displayStyle]);

  const imgStyle = useMemo<CSSProperties | undefined>(
    () => ({ display: 'block', width: '100%', height: '100%' }),
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
        24,
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
