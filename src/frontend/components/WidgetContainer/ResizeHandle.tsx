import { memo, CSSProperties } from 'react';
import type { ResizeDirection } from './useResizeWidget';

const RESIZE_HANDLE_SIZE = 8;

interface ResizeHandleProps {
  direction: ResizeDirection;
  getProps: (direction: ResizeDirection) => Record<string, unknown>;
}

export const ResizeHandle = memo(
  ({ direction, getProps }: ResizeHandleProps) => {
    const props = getProps(direction);
    const style = getHandleStyle(direction);

    return (
      <div
        {...props}
        className="absolute bg-sky-500 opacity-0 hover:opacity-100 transition-opacity"
        style={style}
      />
    );
  }
);

ResizeHandle.displayName = 'ResizeHandle';

export const ResizeHandles = ({
  getResizeHandleProps,
}: {
  getResizeHandleProps: (direction: ResizeDirection) => Record<string, unknown>;
}) => (
  <>
    <ResizeHandle direction="n" getProps={getResizeHandleProps} />
    <ResizeHandle direction="s" getProps={getResizeHandleProps} />
    <ResizeHandle direction="e" getProps={getResizeHandleProps} />
    <ResizeHandle direction="w" getProps={getResizeHandleProps} />
    <ResizeHandle direction="ne" getProps={getResizeHandleProps} />
    <ResizeHandle direction="nw" getProps={getResizeHandleProps} />
    <ResizeHandle direction="se" getProps={getResizeHandleProps} />
    <ResizeHandle direction="sw" getProps={getResizeHandleProps} />
  </>
);

function getHandleStyle(direction: ResizeDirection): CSSProperties {
  const half = RESIZE_HANDLE_SIZE / 2;
  const base: CSSProperties = {
    position: 'absolute',
  };

  switch (direction) {
    case 'n':
      return {
        ...base,
        top: -half,
        left: RESIZE_HANDLE_SIZE,
        right: RESIZE_HANDLE_SIZE,
        height: RESIZE_HANDLE_SIZE,
        cursor: 'ns-resize',
      };
    case 's':
      return {
        ...base,
        bottom: -half,
        left: RESIZE_HANDLE_SIZE,
        right: RESIZE_HANDLE_SIZE,
        height: RESIZE_HANDLE_SIZE,
        cursor: 'ns-resize',
      };
    case 'e':
      return {
        ...base,
        right: -half,
        top: RESIZE_HANDLE_SIZE,
        bottom: RESIZE_HANDLE_SIZE,
        width: RESIZE_HANDLE_SIZE,
        cursor: 'ew-resize',
      };
    case 'w':
      return {
        ...base,
        left: -half,
        top: RESIZE_HANDLE_SIZE,
        bottom: RESIZE_HANDLE_SIZE,
        width: RESIZE_HANDLE_SIZE,
        cursor: 'ew-resize',
      };
    case 'ne':
      return {
        ...base,
        top: -half,
        right: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nesw-resize',
        borderRadius: '0 4px 0 0',
      };
    case 'nw':
      return {
        ...base,
        top: -half,
        left: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nwse-resize',
        borderRadius: '4px 0 0 0',
      };
    case 'se':
      return {
        ...base,
        bottom: -half,
        right: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nwse-resize',
        borderRadius: '0 0 4px 0',
      };
    case 'sw':
      return {
        ...base,
        bottom: -half,
        left: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nesw-resize',
        borderRadius: '0 0 0 4px',
      };
  }
}
