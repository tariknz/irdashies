import { memo, CSSProperties } from 'react';
import type { ResizeDirection } from './resizeWidget';

const RESIZE_HANDLE_SIZE = 8;

interface ResizeHandleProps {
  direction: ResizeDirection;
  getProps: (direction: ResizeDirection) => Record<string, unknown>;
  visible?: boolean;
}

export const ResizeHandle = memo(
  ({ direction, getProps, visible = false }: ResizeHandleProps) => {
    const props = getProps(direction);
    const style = getHandleStyle(direction);

    return (
      <div
        {...props}
        className={`absolute touch-none pointer-events-auto bg-sky-500 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white ${visible && direction.length === 2 ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
        style={style}
      />
    );
  }
);

ResizeHandle.displayName = 'ResizeHandle';

export const ResizeHandles = ({
  getResizeHandleProps,
  visible = false,
}: {
  getResizeHandleProps: (direction: ResizeDirection) => Record<string, unknown>;
  visible?: boolean;
}) => (
  <>
    <ResizeHandle
      direction="n"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="s"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="e"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="w"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="ne"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="nw"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="se"
      getProps={getResizeHandleProps}
      visible={visible}
    />
    <ResizeHandle
      direction="sw"
      getProps={getResizeHandleProps}
      visible={visible}
    />
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
