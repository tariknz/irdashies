import { Meta } from '@storybook/react-vite';
import { useTelemetry } from '@irdashies/context';

export default {
  title: 'components/RerenderTester',
} as Meta;

const RerenderTester = () => {
  const throttle = useTelemetry('AirTemp');
  console.log('RerenderTester', throttle);
  return <div>{JSON.stringify(throttle)}</div>;
};

export const Primary = {
  render: () => <RerenderTester />,
  args: {},
};
