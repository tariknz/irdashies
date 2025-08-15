import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountryFlag, FLAIR_ID_TO_COUNTRY_CODE } from './CountryFlag';

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
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the flag',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
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
];

// All supported flags
const allFlags = Object.entries(FLAIR_ID_TO_COUNTRY_CODE).map(([flairId, countryCode]) => ({
  flairId: parseInt(flairId),
  countryCode,
}));

export const Default: Story = {
  args: {
    flairId: 149, // New Zealand
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    flairId: 149,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    flairId: 149,
    size: 'lg',
  },
};

export const PopularCountries: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4 bg-slate-800 rounded-lg">
      {popularCountries.map((country) => (
        <div key={country.flairId} className="flex flex-col items-center gap-2">
          <CountryFlag flairId={country.flairId} size="md" />
          <span className="text-xs text-white">{country.name}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
      {popularCountries.slice(0, 3).map((country) => (
        <div key={country.flairId} className="flex items-center gap-4">
          <span className="text-white w-24">{country.name}:</span>
          <CountryFlag flairId={country.flairId} size="sm" />
          <CountryFlag flairId={country.flairId} size="md" />
          <CountryFlag flairId={country.flairId} size="lg" />
        </div>
      ))}
    </div>
  ),
};

export const InvalidFlairId: Story = {
  args: {
    flairId: 999999, // Invalid FlairID
    size: 'md',
  },
};

export const Unaffiliated: Story = {
  args: {
    flairId: 1, // Unaffiliated - should show UN flag
    size: 'md',
  },
};

export const AllFlags: Story = {
  render: () => (
    <div className="grid grid-cols-8 gap-2 p-4 bg-slate-800 rounded-lg max-h-96 overflow-y-auto">
      {allFlags.map((flag) => (
        <div key={flag.flairId} className="flex flex-col items-center gap-1">
          <CountryFlag flairId={flag.flairId} size="sm" />
          <span className="text-xs text-white text-center">
            {flag.countryCode}
          </span>
        </div>
      ))}
    </div>
  ),
}; 