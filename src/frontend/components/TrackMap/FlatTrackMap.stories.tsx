import { Meta, StoryObj } from '@storybook/react-vite';
import { FlatTrackMap } from './FlatTrackMap';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: FlatTrackMap,
  title: 'widgets/FlatTrackMap',
} as Meta;

type Story = StoryObj<typeof FlatTrackMap>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const SupercarsRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const AdvancedMX5: Story = {
  decorators: [TelemetryDecorator('/test-data/1732260478001')],
};

export const GT3Practice: Story = {
  decorators: [TelemetryDecorator('/test-data/1732355190142')],
};

export const GT3Race: Story = {
  decorators: [TelemetryDecorator('/test-data/1732359661942')],
};

export const LegendsQualifying: Story = {
  decorators: [TelemetryDecorator('/test-data/1731732047131')],
};

export const TestingCustomSessionData: Story = {
  decorators: [TelemetryDecorator('/test-data/GT3 Sprint Arrays')],
};

export const PCCRaceWithMicUse: Story = {
  decorators: [TelemetryDecorator('/test-data/1733030013074')],
};

export const PCCPacing: Story = {
  decorators: [TelemetryDecorator('/test-data/1735296198162')],
};
