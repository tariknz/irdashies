import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ContainerBoundsInfo, WidgetLayout } from '@irdashies/types';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import { CenterGuide } from './CenterGuide';
import { WidgetContainer } from './WidgetContainer';

/** A small display filling the story frame. */
const DISPLAY = { x: 0, y: 0, width: 960, height: 540 };

const bridge = {
  ...mockDashboardBridge,
  onContainerBoundsInfo: (callback: (value: ContainerBoundsInfo) => void) => {
    callback({
      expected: DISPLAY,
      actual: DISPLAY,
      offset: { x: 0, y: 0 },
      displayBounds: DISPLAY,
    });
    return () => undefined;
  },
};

/** One widget in edit mode on the display, which the story can move. */
const EditModeDisplay = ({
  initialLayout,
  showGuide = false,
}: {
  initialLayout: WidgetLayout;
  showGuide?: boolean;
}) => {
  const [layout, setLayout] = useState(initialLayout);
  return (
    <DashboardProvider bridge={bridge}>
      <div className="fixed inset-0 overflow-hidden bg-blue-900/20">
        <WidgetContainer
          widget={{ id: 'standings', enabled: true, layout }}
          editMode
          zIndex={1}
          onLayoutChange={(_id, next) => setLayout(next)}
        >
          <div className="h-full w-full bg-slate-800/80" />
        </WidgetContainer>
        {showGuide && <CenterGuide bounds={DISPLAY} offset={{ x: 0, y: 0 }} />}
      </div>
    </DashboardProvider>
  );
};

/**
 * Edit mode's center line: a widget dragged near the display's middle shows
 * it until the mouse button is released, and snaps its center onto it when
 * close. Hold Shift to drag without the snap.
 */
const meta = {
  title: 'widgets/WidgetContainer/CenterLine',
  component: EditModeDisplay,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EditModeDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag the widget toward the middle to see the line appear. */
export const Dragging: Story = {
  args: { initialLayout: { x: 60, y: 160, width: 320, height: 200 } },
};

/** The line as it shows while a widget is centered on it. */
export const Centered: Story = {
  args: {
    initialLayout: { x: 320, y: 160, width: 320, height: 200 },
    showGuide: true,
  },
};
