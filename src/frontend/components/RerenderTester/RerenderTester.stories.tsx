import { Meta } from '@storybook/react';
import {
  useDrivers,
  useSession,
} from '../../context/SessionContext/SessionStore';

export default {} as Meta;

const RerenderTester = () => {
  const drivers = useDrivers();
  const session = useSession();
  console.log('RerenderTester', drivers);
  console.log('RerenderTester', session);
  return <div>{JSON.stringify(drivers)}</div>;
};

export const Primary = {
  render: () => <RerenderTester />,
  args: {},
};
