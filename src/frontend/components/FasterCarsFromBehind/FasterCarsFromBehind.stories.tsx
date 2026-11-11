import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { DashboardProvider, useGeneralSettings } from '@irdashies/context';
import { getWidgetManifest } from '@irdashies/types';
import type { GeneralSettingsType } from '@irdashies/types';
import {
  FasterCarsFromBehind,
  FasterCarsFromBehindDisplay,
} from './FasterCarsFromBehind';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
  TelemetryDecoratorWithConfig,
  mockDashboardBridge,
} from '@irdashies/storybook';

const demoBridge = {
  ...mockDashboardBridge,
  onDemoModeChanged: (callback: (enabled: boolean) => void) => {
    callback(true);
    return () => {
      // No-op cleanup for the demo state.
    };
  },
};

const mockSettings = {
  showOnlyWhenOnTrack: true,
  distanceThreshold: -1.5,
  numberDriversBehind: 3,
  alignDriverBoxes: 'Top' as const,
  closestDriverBox: 'Top' as const,
  showName: true,
  removeNumbersFromName: true,
  showDistance: true,
  showBadge: false,
  badgeFormat: 'license-color-rating-bw' as const,
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const displayDecorator = (
  compactMode: GeneralSettingsType['compactMode'] = 'off',
  showBadge = false
) =>
  TelemetryDecoratorWithConfig(
    '/test-data/1747384033336',
    { fastercarsfrombehind: { ...mockSettings, showBadge } },
    { compactMode }
  );

export default {
  component: FasterCarsFromBehindDisplay,
  title: 'widgets/FasterCarsFromBehind',
  argTypes: {
    classColor: {
      options: [undefined, 0xffda59, 0x33ceff, 0xff5888, 0xae6bff, 0xffffff],
      control: { type: 'select' },
    },
    percent: {
      control: { type: 'range', min: 0, max: 100 },
    },
  },
  parameters: { layout: 'centered' },
} as Meta<typeof FasterCarsFromBehindDisplay>;

type Story = StoryObj<typeof FasterCarsFromBehindDisplay>;

export const Primary: Story = {
  render: () => <FasterCarsFromBehind />,
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};

export const DemoMode: Story = {
  render: () => {
    const manifest = getWidgetManifest('fastercarsfrombehind');
    if (!manifest) return <></>;
    const { width, height } = manifest.layout;
    return (
      <DashboardProvider bridge={demoBridge}>
        <div style={{ width, height }}>
          <FasterCarsFromBehind />
        </div>
      </DashboardProvider>
    );
  },
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};

export const Display: Story = {
  args: {
    name: 'Tom Wilson2',
    license: 'A 4.2',
    rating: 1420,
    distance: -0.7,
    percent: (1 - 0.7 / 1.5) * 100,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 3,
    isMultiClass: true,
    isClosest: true,
  },
  decorators: [displayDecorator()],
};

export const MultipleDrivers: Story = {
  render: () => {
    const compactMode = useGeneralSettings()?.compactMode;
    const spacing =
      compactMode === 'ultra'
        ? 'gap-0.5'
        : compactMode === 'compact'
          ? 'gap-[3px]'
          : 'gap-1';
    return (
      <div
        role="list"
        aria-label="Faster cars behind"
        className={`flex w-80 flex-col ${spacing}`}
      >
        <FasterCarsFromBehindDisplay
          name="Tom Wilson2"
          license="A 4.2"
          rating={1420}
          distance={-0.7}
          percent={(1 - 0.7 / 1.5) * 100}
          isClosest
          isMultiClass
          classColor={0xffda59}
          className="GTP"
          classPosition={3}
        />
        <FasterCarsFromBehindDisplay
          name="Jane Smith"
          license="B 3.8"
          rating={1250}
          distance={-1.0}
          percent={(1 - 1.0 / 1.5) * 100}
          isMultiClass
          classColor={0xffda59}
          className="GTP"
          classPosition={5}
        />
        <FasterCarsFromBehindDisplay
          name="Bob Johnson"
          license="C 2.1"
          rating={980}
          distance={-1.4}
          percent={(1 - 1.4 / 1.5) * 100}
          isMultiClass
          classColor={0x33ceff}
          className="LMP2"
          classPosition={2}
        />
      </div>
    );
  },
  decorators: [displayDecorator()],
};

export const Compact: Story = {
  ...MultipleDrivers,
  decorators: [displayDecorator('compact')],
};

export const Ultra: Story = {
  ...MultipleDrivers,
  decorators: [displayDecorator('ultra')],
};

export const WithBadges: Story = {
  ...MultipleDrivers,
  decorators: [displayDecorator('ultra', true)],
};

export const SmoothApproach: Story = {
  ...Display,
  render: (args) => {
    const [gap, setGap] = useState(0.7);
    const [playing, setPlaying] = useState(false);
    useEffect(() => {
      if (!playing) return;
      const start = performance.now();
      const timer = window.setInterval(() => {
        const elapsed = performance.now() - start;
        setGap(Math.max(0.1, 0.7 - (elapsed / 8000) * 0.6));
        if (elapsed >= 8000) setPlaying(false);
      }, 200);
      return () => window.clearInterval(timer);
    }, [playing]);
    return (
      <div className="w-80 space-y-4">
        <FasterCarsFromBehindDisplay
          {...args}
          distance={-gap}
          percent={(1 - gap / 1.5) * 100}
        />
        <button
          type="button"
          className="settings-button"
          disabled={playing}
          onClick={() => {
            setGap(0.7);
            setPlaying(true);
          }}
        >
          {playing ? 'Approaching' : 'Play approach'}
        </button>
      </div>
    );
  },
};

export const SingleClass: Story = {
  ...Display,
  args: {
    ...Display.args,
    classColor: 0xffffff,
    isMultiClass: false,
  },
};

export const LongClassNames: Story = {
  render: () => (
    <div
      role="list"
      aria-label="Long class names"
      className="flex w-70 flex-col gap-0.5"
    >
      {[
        'Supercars - 2019',
        'Hosted All Cars',
        'Ligier JS P320',
        'Hypercar',
        'Unknown future class with a much longer name',
      ].map((className, index) => (
        <FasterCarsFromBehindDisplay
          key={className}
          {...Display.args}
          name="Tom Wilson"
          className={className}
          classPosition={index + 1}
        />
      ))}
    </div>
  ),
  decorators: [displayDecorator('ultra')],
};

export const MissingClassData: Story = {
  ...Display,
  args: {
    ...Display.args,
    className: undefined,
    classPosition: undefined,
  },
};
