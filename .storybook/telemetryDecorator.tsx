import { StoryFn } from '@storybook/react';
import { generateMockDataFromPath } from '../src/app/bridge/iracingSdk/mock-data/generateMockData';
import { SessionProvider, TelemetryProvider } from '@irdashies/context';

export const TelemetryDecorator = (path?: string) => (Story: StoryFn) => {
  return (
    <SessionProvider bridge={generateMockDataFromPath(path)}>
      <TelemetryProvider bridge={generateMockDataFromPath(path)} />
      <Story />
    </SessionProvider>
  );
};
