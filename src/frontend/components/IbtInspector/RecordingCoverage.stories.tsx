import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecordingCoverage } from './RecordingCoverage';

const meta = {
  component: RecordingCoverage,
  parameters: { layout: 'padded' },
  args: {
    status: {
      file: 'session.ibt',
      playback: {
        position: 4,
        duration: 60,
        speed: 1,
        paused: true,
        ended: false,
        canStep: true,
        loop: { start: 4, end: 8 },
      },
      warnings: [],
      coverage: [
        { widget: 'input', status: 'fields-present', missing: [] },
        {
          widget: 'radar',
          status: 'missing-fields',
          missing: ['CarIdxLapDistPct'],
        },
      ],
      capture: {
        active: false,
        samples: 0,
        reportPath: null,
        error: null,
        telemetry: [],
        memoryCheckpoints: [],
        baseline: null,
        heapSampling: { attachedTargets: 0, skippedTargets: 0 },
        hottestSections: [],
        channelActivity: [],
      },
    },
  },
} satisfies Meta<typeof RecordingCoverage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingFields: Story = {};
export const Capturing: Story = {
  args: {
    status: {
      ...meta.args.status,
      capture: { ...meta.args.status.capture, active: true },
    },
  },
};
