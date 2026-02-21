import { isValidElement, cloneElement, createElement } from 'react';
import type { CSSProperties, ReactNode, ReactElement } from 'react';
import { colorNumToHex } from '@irdashies/utils/colors';
import { PHOSPHOR_ICON_MAP } from './phosphorIconMap';

type IconFactory = (props: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  color?: string;
  weight?: string;
}) => ReactNode;

export function renderDriverIcon(
  icon: unknown,
  size = 24,
  className?: string,
  colorNum?: number,
  style?: CSSProperties,
  fallbackStyle?: CSSProperties,
  weight?: string
): ReactNode {
  if (icon === undefined || icon === null) return null;
  const colorHex = colorNumToHex(colorNum);

  if (typeof icon === 'string' && icon.startsWith('data:')) {
    return (
      <img
        src={icon}
        alt="icon"
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          ...(style ?? {}),
        }}
      />
    );
  }

  if (typeof icon === 'string' && icon.trim()) {
    // Look up as a Phosphor icon name (e.g. "Car" or "CarIcon" → CarIcon component).
    const trimmed = icon.trim();
    const IconComp =
      PHOSPHOR_ICON_MAP.get(trimmed) ??
      PHOSPHOR_ICON_MAP.get(trimmed.replace(/Icon$/, ''));
    if (IconComp != null) {
      try {
        const el = createElement(IconComp as React.ElementType, {
          size,
          className,
          style: { width: size, height: size, ...(style ?? {}) },
          color: colorHex ?? undefined,
          weight,
        });
        if (isValidElement(el)) return el;
      } catch {
        // fall through
      }
    }
    return (
      <span
        className={className}
        style={{ color: colorHex ?? undefined, ...(fallbackStyle ?? {}) }}
      >
        {icon}
      </span>
    );
  }

  if (isValidElement(icon as ReactElement)) {
    // clone and inject size/color/style/weight
    const ie = icon as ReactElement & { props?: Record<string, unknown> };
    const mergedStyle = {
      ...((ie.props?.style as CSSProperties) ?? {}),
      ...(style ?? {}),
    };
    return cloneElement(
      ie as ReactElement<Record<string, unknown>>,
      { size, color: colorHex, style: mergedStyle, weight } as Record<
        string,
        unknown
      >
    );
  }

  if (typeof icon === 'function') {
    try {
      const factory = icon as IconFactory;
      const el = factory({
        size,
        className,
        style: { width: size, height: size, ...(style ?? {}) },
        color: colorHex,
        weight,
      });
      if (isValidElement(el)) return el;
      return (
        <span
          className={className}
          style={{ color: colorHex ?? undefined, ...(fallbackStyle ?? {}) }}
        >
          {String(el)}
        </span>
      );
    } catch {
      // fall through to string rendering
    }
  }

  return (
    <span
      className={className}
      style={{ color: colorHex ?? undefined, ...(fallbackStyle ?? {}) }}
    >
      {String(icon)}
    </span>
  );
}

export default renderDriverIcon;
