import { Meta, StoryObj } from '@storybook/react-vite';
import { TrackMap } from './TrackMap';
import { TelemetryDecorator, TelemetryDecoratorWithConfig } from '@irdashies/storybook';

export default {
  component: TrackMap,
  title: 'widgets/TrackMap',
} as Meta;

type Story = StoryObj<typeof TrackMap>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const PrimaryFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig(undefined, { map: { mapStyle: 'flat' } })],
};

export const FlatMap: Story = {
  decorators: [TelemetryDecoratorWithConfig(undefined, { map: { mapStyle: 'flat', enableTurnNames: true } })],
};

export const SupercarsRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const SupercarsRaceFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1732274253573', { map: { mapStyle: 'flat' } })],
};

export const AdvancedMX5: Story = {
  decorators: [TelemetryDecorator('/test-data/1732260478001')],
};

export const AdvancedMX5Flat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1732260478001', { map: { mapStyle: 'flat' } })],
};

export const GT3Practice: Story = {
  decorators: [TelemetryDecorator('/test-data/1732355190142')],
};

export const GT3PracticeFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1732355190142', { map: { mapStyle: 'flat' } })],
};

export const GT3Race: Story = {
  decorators: [TelemetryDecorator('/test-data/1732359661942')],
};

export const GT3RaceFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1732359661942', { map: { mapStyle: 'flat' } })],
};

export const LegendsQualifying: Story = {
  decorators: [TelemetryDecorator('/test-data/1731732047131')],
};

export const LegendsQualifyingFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1731732047131', { map: { mapStyle: 'flat' } })],
};

export const TestingCustomSessionData: Story = {
  decorators: [TelemetryDecorator('/test-data/GT3 Sprint Arrays')],
};

export const TestingCustomSessionDataFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/GT3 Sprint Arrays', { map: { mapStyle: 'flat' } })],
};

export const PCCRaceWithMicUse: Story = {
  decorators: [TelemetryDecorator('/test-data/1733030013074')],
};

export const PCCRaceWithMicUseFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1733030013074', { map: { mapStyle: 'flat' } })],
};

export const PCCPacing: Story = {
  decorators: [TelemetryDecorator('/test-data/1735296198162')],
};

export const PCCPacingFlat: Story = {
  decorators: [TelemetryDecoratorWithConfig('/test-data/1735296198162', { map: { mapStyle: 'flat' } })],
};
