import { Meta } from '@storybook/react';
import {
  useDrivers,
  useSession,
} from '../../context/SessionContext/SessionStore';
import { useTelemetryValue } from '../../context/TelemetryStore/TelemetryStore';

export default {} as Meta;

const RerenderTester = () => {
  const throttle = useTelemetryValue('AirTemp');
  console.log('RerenderTester', throttle);
  return <div>{JSON.stringify(throttle)}</div>;
};

export const Primary = {
  render: () => <RerenderTester />,
  args: {},
};
