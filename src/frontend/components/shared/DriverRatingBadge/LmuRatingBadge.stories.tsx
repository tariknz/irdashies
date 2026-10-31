import type { Meta, StoryObj } from '@storybook/react-vite';
import { LMU_BADGE_FORMATS, type LmuDriverRating } from '@irdashies/types';
import { LmuRatingBadge } from './LmuRatingBadge';

const meta: Meta<typeof LmuRatingBadge> = {
  component: LmuRatingBadge,
  title: 'Components/LmuRatingBadge',
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof LmuRatingBadge>;

const rating = (over: Partial<LmuDriverRating> = {}): LmuDriverRating => ({
  driverRank: 'Gold',
  driverTier: 3,
  safetyRank: 'Silver',
  safetyTier: 1,
  ...over,
});

export const Default: Story = { args: { rating: rating() } };

export const Minimal: Story = {
  args: { rating: rating(), isMinimal: true },
};

export const DriverRankOnly: Story = {
  args: { rating: { driverRank: 'Platinum', driverTier: 2 } },
};

/** Pro carries no tier, so it reads as a word. */
export const Pro: Story = {
  args: {
    rating: { driverRank: 'Pro', safetyRank: 'Platinum', safetyTier: 4 },
  },
};

/** An AI entry, or a human the rating service does not know: nothing drawn. */
export const Unrated: Story = {
  args: { rating: { countryCode: 'FR' } },
};

/** Every rank, so the palette can be compared at a glance. */
export const AllRanks: Story = {
  render: () => (
    <div className="flex flex-col gap-2 bg-slate-900 p-3">
      {(['Bronze', 'Silver', 'Gold', 'Platinum', 'Pro'] as const).map(
        (rank) => (
          <div key={rank} className="flex items-center gap-3">
            <span className="w-20 text-xs text-slate-400">{rank}</span>
            <LmuRatingBadge
              rating={{ driverRank: rank, driverTier: 3 }}
              showSafety={false}
            />
            <LmuRatingBadge
              rating={{ driverRank: rank, driverTier: 3 }}
              showSafety={false}
              isMinimal
            />
          </div>
        )
      )}
    </div>
  ),
};

/** The four formats the Rating setting offers, one per row. */
export const AllFormats: Story = {
  render: () => (
    <div className="flex flex-col gap-3 bg-slate-900 p-3 text-xs">
      {LMU_BADGE_FORMATS.map((format) => (
        <div key={format} className="flex items-center gap-4">
          <span className="w-20 text-slate-400">{format}</span>
          <LmuRatingBadge rating={rating()} format={format} />
        </div>
      ))}
    </div>
  ),
};
