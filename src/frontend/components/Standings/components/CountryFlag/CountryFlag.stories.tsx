import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountryFlag, FLAIR_ID_TO_COUNTRY_CODE } from './CountryFlag';
import { IRacingFlag } from './IRacingFlag';

const meta: Meta<typeof CountryFlag> = {
  component: CountryFlag,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    flairId: {
      control: { type: 'number' },
      description: 'FlairID from the flairs.json data',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Popular countries for examples
const popularCountries = [
  { flairId: 149, name: 'New Zealand' },
  { flairId: 223, name: 'United States' },
  { flairId: 222, name: 'United Kingdom' },
  { flairId: 77, name: 'Germany' },
  { flairId: 71, name: 'France' },
  { flairId: 101, name: 'Italy' },
  { flairId: 198, name: 'Spain' },
  { flairId: 16, name: 'Australia' },
  { flairId: 39, name: 'Canada' },
  { flairId: 104, name: 'Japan' },
  { flairId: 45, name: 'China' },
  { flairId: 9999, name: 'iRacing' },
];

// All supported flags
const allFlags = Object.entries(FLAIR_ID_TO_COUNTRY_CODE).map(
  ([flairId, countryCode]) => ({
    flairId: parseInt(flairId),
    countryCode,
  })
);

export const Default: Story = {
  args: {
    flairId: 149, // New Zealand
  },
};

export const PopularCountries: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4 bg-slate-800 rounded-lg">
      {popularCountries.map((country) => (
        <div key={country.flairId} className="flex flex-col items-center gap-2">
          <CountryFlag flairId={country.flairId} />
          <span className="text-xs text-white">{country.name}</span>
        </div>
      ))}
    </div>
  ),
};

export const InvalidFlairId: Story = {
  args: {
    flairId: 999999, // Invalid FlairID
  },
};

export const Unaffiliated: Story = {
  args: {
    flairId: 1, // Unaffiliated - should show UN flag
  },
};

export const AllFlags: Story = {
  render: () => (
    <div className="grid grid-cols-8 gap-2 p-4 bg-slate-800 rounded-lg max-h-96 overflow-y-auto">
      <div className="flex flex-col items-center gap-1">
        <IRacingFlag />
        <span className="text-xs text-white text-center">iR</span>
      </div>
      {allFlags.map((flag) => (
        <div key={flag.flairId} className="flex flex-col items-center gap-1">
          <CountryFlag flairId={flag.flairId} />
          <span className="text-xs text-white text-center">
            {flag.countryCode}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const IRacing: Story = {
  name: 'iRacing',
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <CountryFlag flairId={9999} />
      </div>
    </div>
  ),
};
