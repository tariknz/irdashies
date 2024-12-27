import { Meta } from '@storybook/react';
import { useTelemetry } from '../../context/TelemetryStore/TelemetryStore';

export default {} as Meta;

const RerenderTester = () => {
  const throttle = useTelemetry('AirTemp');
  console.log('RerenderTester', throttle);
  return <div>{JSON.stringify(throttle)}</div>;
};

export const Primary = {
  render: () => <RerenderTester />,
  args: {},
};
