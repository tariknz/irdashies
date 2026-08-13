import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeltaSpeedBox } from './DeltaSpeedBox';

/**
 * Deterministic visual states. No store or telemetry setup, so this is the
 * fast loop for iterating on the box itself.
 */
export default {
  component: DeltaSpeedBox,
  title: 'widgets/DeltaSpeed/Box',
  args: {
    deltaKph: 4.2,
    scale: 15,
    // Off by default: these stories are static snapshots, and the update
    // threshold only has an effect across successive values.
    cap: 0,
    updateThreshold: 0,
    unit: 'km/h',
    showNumber: true,
  },
  decorators: [
    // Mirrors the real widget container so the box is judged in the setting it
    // actually appears in: the shared slate panel at the default widget size,
    // not a bare background at arbitrary dimensions.
    (Story) => (
      <div className="h-[40px] w-[160px] rounded-sm bg-slate-800/80 p-2">
        <Story />
      </div>
    ),
  ],
} as Meta<typeof DeltaSpeedBox>;

type Story = StoryObj<typeof DeltaSpeedBox>;

export const Faster: Story = {};

export const Slower: Story = { args: { deltaKph: -6.8 } };

/**
 * Where a driver who is fine-tuning actually lives. Almost no colour, but the
 * number is still exact and fully legible — the point of the design.
 */
export const FineTuning: Story = { args: { deltaKph: 0.4 } };

/** Only the static outline shows; the fill is fully transparent. */
export const Neutral: Story = { args: { deltaKph: 0 } };

/** At and beyond the cap the fill is fully saturated. */
export const AtFullScale: Story = { args: { deltaKph: 15 } };

export const BeyondFullScale: Story = { args: { deltaKph: 42 } };

/** Same delta, converted, against the whole-number mph cap. */
export const Mph: Story = { args: { deltaKph: 4.2, unit: 'mph', scale: 10 } };

export const BoxOnly: Story = { args: { showNumber: false } };

/** A tighter cap makes small deltas read sooner. */
export const NarrowScale: Story = { args: { deltaKph: 4.2, scale: 5 } };

/** Well past the cap: the number holds at the limit, the fill stays saturated. */
export const Capped: Story = { args: { deltaKph: 42, cap: 9 } };

/** The two tighter densities, matching the app-wide compact mode. */
export const Compact: Story = { args: { density: 'compact' } };

export const Ultra: Story = { args: { density: 'ultra' } };
