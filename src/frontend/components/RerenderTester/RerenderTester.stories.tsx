import { Meta } from '@storybook/react-vite';
import { useTelemetry } from '@irdashies/context';
import logger from '@irdashies/utils/logger';

export default {
  title: 'components/RerenderTester',
} as Meta;

const RerenderTester = () => {
  const throttle = useTelemetry('AirTemp');
  logger.info('RerenderTester', throttle);
  return <div>{JSON.stringify(throttle)}</div>;
};

export const Primary = {
  render: () => <RerenderTester />,
  args: {},
};
