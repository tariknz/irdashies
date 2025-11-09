import { Meta, StoryObj } from '@storybook/react-vite';
import { DriverInfoRow } from './DriverInfoRow';
import { DriverRatingBadge } from '../DriverRatingBadge/DriverRatingBadge';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SessionBar } from '../SessionBar/SessionBar';
import { SessionFooter } from '../SessionFooter/SessionFooter';
import { RatingChange } from '../RatingChange/RatingChange';

export default {
  component: DriverInfoRow,
  decorators: [
    (Story) => (
      <table className="w-full">
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof DriverInfoRow>;

export const Primary: Story = {
  args: {
    carIdx: 1,
    carNumber: '999',
    name: 'John Doe',
    isPlayer: false,
    delta: 0.1,
    position: 1,
    classColor: 16777215,
    fastestTime: 111.111,
    lastTime: 112.225,
    badge: <DriverRatingBadge license="A 4.99" rating={4999} />,
    onPitRoad: false,
    onTrack: true,
    tireCompound: 1
  },
};

export const HasFastestLap: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: true,
  },
};

export const LastLapIsFastestLap: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: true,
    fastestTime: 111.111,
    lastTime: 111.111,
  },
};

export const LastLapIsBestTime: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: false,
    fastestTime: 111.111,
    lastTime: 111.111,
  },
};

export const OnPitRoad: Story = {
  args: {
    ...Primary.args,
    onPitRoad: true,
  },
};

export const NotOnTrack: Story = {
  args: {
    ...Primary.args,
    onTrack: false,
  },
};

export const RadioActive: Story = {
  args: {
    ...Primary.args,
    radioActive: true,
  },
};

export const IsPlayer: Story = {
  args: {
    ...Primary.args,
    isPlayer: true,
  },
};

export const IsLapped: Story = {
  args: {
    ...Primary.args,
    isLapped: true,
  },
};

export const IsLappingAhead: Story = {
  args: {
    ...Primary.args,
    isLappingAhead: true,
  },
};

export const IRatingChange: Story = {
  name: 'iRating Positive Change',
  args: {
    ...Primary.args,
    iratingChange: <RatingChange value={10} />,
  },
};

export const IRatingChangeNegative: Story = {
  name: 'iRating Negative Change',
  args: {
    ...Primary.args,
    iratingChange: <RatingChange value={-58} />,
  },
};

export const IRatingNoChange: Story = {
  name: 'iRating No Change',
  args: {
    ...Primary.args,
    iratingChange: <RatingChange value={0} />,
  },
};

export const Relative = () => {
  const getRandomRating = () =>
    Math.floor(Math.random() * (1300 - 700 + 1)) + 700;
  const getRandomLicense = () => {
    const licenses = ['C', 'B', 'A'];
    const license = licenses[Math.floor(Math.random() * licenses.length)];
    const rating = (Math.random() * (4.5 - 1.5) + 1.5).toFixed(2);
    return `${license} ${rating}`;
  };

  const names = [
    'Alice',
    'Bob',
    'Charlie',
    'David',
    'Eve',
    'Frank',
    'Grace',
    'Hank',
    'Ivy',
    'Jack',
  ];
  const getRandomName = () => names[Math.floor(Math.random() * names.length)];
  const getRandomSurname = () => {
    const surnames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
    ];
    return surnames[Math.floor(Math.random() * surnames.length)];
  };

  const getRandomMiddleName = () => {
    const middleNames = [
      'James',
      'Marie',
      'Lee',
      'Ann',
      'Grace',
      'John',
      'Michael',
      'Elizabeth',
      'David',
      'Rose',
    ];
    return middleNames[Math.floor(Math.random() * middleNames.length)];
  };

  const getRandomFullName = () => {
    const hasMiddleName = Math.random() > 0.5;
    const firstName = getRandomName();
    const surname = getRandomSurname();
    if (hasMiddleName) {
      const middleName = getRandomMiddleName();
      return `${firstName} ${middleName} ${surname}`;
    }
    return `${firstName} ${surname}`;
  };

  const standings = [
    {
      carIdx: 1,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 223, // United States
      },
      isPlayer: false,
      delta: 12,
      classPosition: 1,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: undefined,
      tireCompound: 0,
      lastPitLap: 0
    },
    {
      carIdx: 2,
      carClass: { color: 0xffda59 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 222, // United Kingdom
      },
      isPlayer: false,
      delta: 2.7,
      classPosition: 9,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'ahead',
      tireCompound: 1,
      lastPitLap: 0
    },
    {
      carIdx: 3,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 77, // Germany
      },
      isPlayer: false,
      delta: 0.7,
      classPosition: 2,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 0,
    },
    {
      carIdx: 4,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '23',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 71, // France
      },
      isPlayer: true,
      delta: 0,
      classPosition: 3,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 15
    },
    {
      carIdx: 5,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 101, // Italy
      },
      isPlayer: false,
      delta: -0.3,
      classPosition: 12,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'behind',
      tireCompound: 1,
      lastPitLap: 0
    },
    {
      carIdx: 6,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 198, // Spain
      },
      isPlayer: false,
      delta: -3.9,
      classPosition: 4,
      hasFastestTime: false,
      onPitRoad: true,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 0
    },
    {
      carIdx: 7,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 39, // Canada
      },
      isPlayer: false,
      delta: -33.2,
      classPosition: 7,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: true,
      tireCompound: 1,
      lastPitLap: 5
    },
  ];
  const getRandomCarNum = () => Math.floor(Math.random() * 35) + 1;
  standings.forEach((standing) => {
    standing.driver.carNum = getRandomCarNum().toString();
  });

  const [parent] = useAutoAnimate();

  return (
    <div className="w-full h-full">
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody ref={parent}>
          {standings.map((result) => (
            <DriverInfoRow
              key={result.carIdx}
              carIdx={result.carIdx}
              classColor={result.carClass.color}
              carNumber={result.driver?.carNum || ''}
              name={result.driver?.name || ''}
              isPlayer={result.isPlayer}
              hasFastestTime={result.hasFastestTime}
              delta={result.delta}
              position={result.classPosition}
              onPitRoad={result.onPitRoad}
              onTrack={result.onTrack}
              radioActive={result.radioActive}
              isLapped={result.lappedState === 'behind'}
              isLappingAhead={result.lappedState === 'ahead'}
              flairId={result.driver?.flairId}
              tireCompound={result.tireCompound}
              badge={
                <DriverRatingBadge
                  license={result.driver?.license}
                  rating={result.driver?.rating}
                />
              }
              isMultiClass={false}
            />
          ))}
        </tbody>
      </table>
      <SessionFooter />
    </div>
  );
};

export const MockedRelativeTable: Story = {
  render: () => <Relative />,
};
