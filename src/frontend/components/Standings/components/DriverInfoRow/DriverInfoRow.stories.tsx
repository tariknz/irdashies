import { Meta, StoryObj } from '@storybook/react-vite';
import { DriverInfoRow } from './DriverInfoRow';
import { useCurrentSessionType } from '@irdashies/context';
import type { StandingsWidgetSettings } from '../../../Settings/types';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../CarManufacturer/carManufacturerMapping';

export default {
  component: DriverInfoRow,
  title: 'widgets/Standings/components/DriverInfoRow',
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
    hasFastestTime: false,
    delta: 0.1,
    position: 1,
    lap: 2,
    classColor: 16777215,
    fastestTime: 111.111,
    lastTime: 112.225,
    license: 'A 4.99',
    rating: 4999,
    iratingChangeValue: 10,
    onPitRoad: false,
    onTrack: true,
    radioActive: false,
    tireCompound: 1,
    isMultiClass: false,
    flairId: 2,
    carId: 122,
    currentSessionType: 'Race',
    config: {
      fastestTime: { enabled: true },
      lastTime: { enabled: true },
      iratingChange: { enabled: true },
      badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
      pitStatus: { enabled: true, showPitTime: true },
    } as StandingsWidgetSettings['config'],
    dnf: false,
    repair: false,
    penalty: false,
    slowdown: false,
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

export const RadioActiveWithStatus: Story = {
  args: {
    ...Primary.args,
    radioActive: true,
    penalty: true,
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
    iratingChangeValue: 10,
  },
};

export const IRatingChangeNegative: Story = {
  name: 'iRating Negative Change',
  args: {
    ...Primary.args,
    iratingChangeValue: -58,
  },
};

export const IRatingNoChange: Story = {
  name: 'iRating No Change',
  args: {
    ...Primary.args,
    iratingChangeValue: 0,
  },
};

export const OffTrack: Story = {
  args: {
    ...Primary.args,
    carTrackSurface: 0,
  },
};


// Pre-generated mock data for Relative story (generated at module load, not during render)
const mockRelativeData = (() => {
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  let seed = 42;
  const random = () => seededRandom(seed++);
  
  const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'];
  const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const middleNames = ['James', 'Marie', 'Lee', 'Ann', 'Grace', 'John', 'Michael', 'Elizabeth', 'David', 'Rose'];
  const licenses = ['C', 'B', 'A'];
  
  const getRating = () => Math.floor(random() * (1300 - 700 + 1)) + 700;
  const getLicense = () => {
    const license = licenses[Math.floor(random() * licenses.length)];
    const rating = (random() * (4.5 - 1.5) + 1.5).toFixed(2);
    return `${license} ${rating}`;
  };
  const getFullName = () => {
    const hasMiddleName = random() > 0.5;
    const firstName = names[Math.floor(random() * names.length)];
    const surname = surnames[Math.floor(random() * surnames.length)];
    if (hasMiddleName) {
      const middleName = middleNames[Math.floor(random() * middleNames.length)];
      return `${firstName} ${middleName} ${surname}`;
    }
    return `${firstName} ${surname}`;
  };
  const getCarNum = () => (Math.floor(random() * 35) + 1).toString();
  
  return {
    drivers: Array.from({ length: 7 }, () => ({
      name: getFullName(),
      license: getLicense(),
      rating: getRating(),
      carNum: getCarNum(),
    })),
  };
})();

const Relative = () => {
  const currentSessionType = useCurrentSessionType();
  const standings = [
    {
      carIdx: 1,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: mockRelativeData.drivers[0].carNum,
        name: mockRelativeData.drivers[0].name,
        license: mockRelativeData.drivers[0].license,
        rating: mockRelativeData.drivers[0].rating,
        flairId: 223, // United States
      },
      isPlayer: false,
      delta: 12,
      classPosition: 1,
      lap: 2,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: undefined,
      tireCompound: 0,
      lastPitLap: 0,
      currentSessionType,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 2,
      carClass: { color: 0xffda59 },
      driver: {
        carNum: mockRelativeData.drivers[1].carNum,
        name: mockRelativeData.drivers[1].name,
        license: mockRelativeData.drivers[1].license,
        rating: mockRelativeData.drivers[1].rating,
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
      lastPitLap: 0,
      currentSessionType,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 3,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: mockRelativeData.drivers[2].carNum,
        name: mockRelativeData.drivers[2].name,
        license: mockRelativeData.drivers[2].license,
        rating: mockRelativeData.drivers[2].rating,
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
      currentSessionType,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 4,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: mockRelativeData.drivers[3].carNum,
        name: mockRelativeData.drivers[3].name,
        license: mockRelativeData.drivers[3].license,
        rating: mockRelativeData.drivers[3].rating,
        flairId: 2, // iRacing
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
      lastPitLap: 15,
      currentSessionType,
      dnf: true,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 5,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: mockRelativeData.drivers[4].carNum,
        name: mockRelativeData.drivers[4].name,
        license: mockRelativeData.drivers[4].license,
        rating: mockRelativeData.drivers[4].rating,
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
      lastPitLap: 0,
      currentSessionType,
      dnf: false,
      repair: true,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 6,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: mockRelativeData.drivers[5].carNum,
        name: mockRelativeData.drivers[5].name,
        license: mockRelativeData.drivers[5].license,
        rating: mockRelativeData.drivers[5].rating,
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
      lastPitLap: 0,
      currentSessionType,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 7,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: mockRelativeData.drivers[6].carNum,
        name: mockRelativeData.drivers[6].name,
        license: mockRelativeData.drivers[6].license,
        rating: mockRelativeData.drivers[6].rating,
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
      lastPitLap: 5,
      currentSessionType,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
  ];

  return (
    <div className="w-full h-full">
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody>
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
              lap={result.lap}
              onPitRoad={result.onPitRoad}
              onTrack={result.onTrack}
              radioActive={result.radioActive}
              isLapped={result.lappedState === 'behind'}
              isLappingAhead={result.lappedState === 'ahead'}
              flairId={result.driver?.flairId}
              tireCompound={result.tireCompound}
              license={result.driver?.license}
              rating={result.driver?.rating}
              isMultiClass={false}
              currentSessionType={result.currentSessionType}
              dnf={result.dnf}
              repair={result.repair}
              penalty={result.penalty}
              slowdown={result.slowdown}
              config={{ badge: { enabled: true, badgeFormat: 'license-color-rating-bw' } } as StandingsWidgetSettings['config']}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const MockedRelativeTable: Story = {
  render: () => <Relative />,
};

const AllBadgeFormats = () => {
  const badgeFormats: {
    name: string;
    format: StandingsWidgetSettings['config']['badge']['badgeFormat'];
  }[] = [
    { name: 'License Color Rating B&W', format: 'license-color-rating-bw' },
    { name: 'License Color Rating B&W (No License)', format: 'license-color-rating-bw-no-license' },
    { name: 'Rating Color (No License)', format: 'rating-color-no-license' },
    { name: 'License B&W Rating B&W', format: 'license-bw-rating-bw' },
    { name: 'Rating Only B&W Rating B&W', format: 'rating-only-bw-rating-bw' },
    { name: 'License B&W Rating B&W (No License)', format: 'license-bw-rating-bw-no-license' },
    { name: 'Rating B&W (No License)', format: 'rating-bw-no-license' },
  ];

  return (
    <div className="w-full h-full">
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody>
          {badgeFormats.map((badgeFormat, index) => (
            <DriverInfoRow
              key={index}
              carIdx={index + 1}
              carNumber={`${index + 1}`}
              name={badgeFormat.name}
              isPlayer={false}
              hasFastestTime={false}
              delta={0.1}
              position={index + 1}
              lap={2}
              classColor={16777215}
              fastestTime={111.111}
              lastTime={112.225}
              license="A 4.99"
              rating={4999}
              iratingChangeValue={10}
              onPitRoad={false}
              onTrack={true}
              radioActive={false}
              tireCompound={1}
              isMultiClass={false}
              flairId={2}
              carId={122}
              currentSessionType="Race"
              dnf={false}
              repair={false}
              penalty={false}
              slowdown={false}
              config={{
                ...Primary.args?.config,
                badge: { enabled: true, badgeFormat: badgeFormat.format },
              } as StandingsWidgetSettings['config']}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AllBadgeFormatsStory: Story = {
  render: () => <AllBadgeFormats />,
};

const AllFlagCombinations = () => {
  const flagCombinations = [
    { name: 'No Flags', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF Only', dnf: true, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Repair Only', dnf: false, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Penalty Only', dnf: false, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Slowdown Only', dnf: false, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Repair', dnf: true, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Penalty', dnf: true, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Slowdown', dnf: true, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Repair + Penalty', dnf: false, repair: true, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Repair + Slowdown', dnf: false, repair: true, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Penalty + Slowdown', dnf: false, repair: false, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Repair + Penalty', dnf: true, repair: true, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Repair + Slowdown', dnf: true, repair: true, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'DNF + Penalty + Slowdown', dnf: true, repair: false, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Repair + Penalty + Slowdown', dnf: false, repair: true, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'All Flags', dnf: true, repair: true, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: undefined, carTrackSurface: undefined, prevCarTrackSurface: undefined },
    { name: 'Outlap', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + DNF', dnf: true, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Repair', dnf: false, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Penalty', dnf: false, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Slowdown', dnf: false, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'PIT', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + DNF', dnf: true, repair: false, penalty: false, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Repair', dnf: false, repair: true, penalty: false, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Penalty', dnf: false, repair: false, penalty: true, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Slowdown', dnf: false, repair: false, penalty: false, slowdown: true, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'Pit Lap (L 5)', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap with Time (L 5 1:24)', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined, pitStopDuration: 84 },
    { name: 'Pit Lap with Time (L 5 0:34)', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined, pitStopDuration: 34 },
    { name: 'Pit Lap with Time (L 5 0:34)', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined, pitStopDuration: 34 },
    { name: 'Pit Lap + DNF', dnf: true, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Repair', dnf: false, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Penalty', dnf: false, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Slowdown', dnf: false, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'TOW', dnf: false, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + DNF', dnf: true, repair: false, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Repair', dnf: false, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Penalty', dnf: false, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Slowdown', dnf: false, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'Outlap + DNF + Repair', dnf: true, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + DNF + Penalty', dnf: true, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + DNF + Slowdown', dnf: true, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Repair + Penalty', dnf: false, repair: true, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Repair + Slowdown', dnf: false, repair: true, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + Penalty + Slowdown', dnf: false, repair: false, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Outlap + All Flags', dnf: true, repair: true, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 5, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'PIT + DNF + Repair', dnf: true, repair: true, penalty: false, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + DNF + Penalty', dnf: true, repair: false, penalty: true, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + DNF + Slowdown', dnf: true, repair: false, penalty: false, slowdown: true, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Repair + Penalty', dnf: false, repair: true, penalty: true, slowdown: false, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Repair + Slowdown', dnf: false, repair: true, penalty: false, slowdown: true, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + Penalty + Slowdown', dnf: false, repair: false, penalty: true, slowdown: true, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'PIT + All Flags', dnf: true, repair: true, penalty: true, slowdown: true, onPitRoad: true, lastPitLap: undefined, lastLap: undefined, carTrackSurface: 2, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + DNF + Repair', dnf: true, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + DNF + Penalty', dnf: true, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + DNF + Slowdown', dnf: true, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Repair + Penalty', dnf: false, repair: true, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Repair + Slowdown', dnf: false, repair: true, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + Penalty + Slowdown', dnf: false, repair: false, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'Pit Lap + All Flags', dnf: true, repair: true, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: 5, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: undefined },
    { name: 'TOW + DNF + Repair', dnf: true, repair: true, penalty: false, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + DNF + Penalty', dnf: true, repair: false, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + DNF + Slowdown', dnf: true, repair: false, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Repair + Penalty', dnf: false, repair: true, penalty: true, slowdown: false, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Repair + Slowdown', dnf: false, repair: true, penalty: false, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + Penalty + Slowdown', dnf: false, repair: false, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
    { name: 'TOW + All Flags', dnf: true, repair: true, penalty: true, slowdown: true, onPitRoad: false, lastPitLap: undefined, lastLap: 10, carTrackSurface: 1, prevCarTrackSurface: 0 },
  ];

  return (
    <div className="w-full h-full max-w-2xl">
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody>
          {flagCombinations.map((combo, index) => (
            <DriverInfoRow
              key={index}
              carIdx={index + 1}
              carNumber={`${index + 1}`}
              name={combo.name}
              isPlayer={false}
              hasFastestTime={false}
              delta={0.1}
              position={index + 1}
              lap={2}
              classColor={16777215}
              fastestTime={111.111}
              lastTime={112.225}
              license="A 4.99"
              rating={4999}
              iratingChangeValue={0}
              onPitRoad={combo.onPitRoad}
              onTrack={true}
              radioActive={false}
              tireCompound={1}
              isMultiClass={false}
              flairId={2}
              carId={122}
              currentSessionType="Race"
              dnf={combo.dnf}
              repair={combo.repair}
              penalty={combo.penalty}
              slowdown={combo.slowdown}
              lastPitLap={combo.lastPitLap}
              lastLap={combo.lastLap}
              carTrackSurface={combo.carTrackSurface}
              prevCarTrackSurface={combo.prevCarTrackSurface}
              pitStopDuration={combo.pitStopDuration}
              config={{
                fastestTime: { enabled: true, timeFormat: 'full' },
                lastTime: { enabled: true, timeFormat: 'full' },
                iratingChange: { enabled: true },
                badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
                pitStatus: { enabled: true, showPitTime: true },
              } as StandingsWidgetSettings['config']}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AllFlagCombinationsStory: Story = {
  render: () => <AllFlagCombinations />,
};

const AllCarsComponent = () => {
  const carEntries = Object.entries(CAR_ID_TO_CAR_MANUFACTURER)
    .map(([id, data]) => ({ id: Number(id), ...data }))
    .sort((a, b) => a.id - b.id);

  return (
    <div className="w-full h-full max-h-[90vh] overflow-y-auto">
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody>
          {carEntries.map(({ id, name }, index) => (
            <DriverInfoRow
              key={id}
              carIdx={index + 1}
              carNumber={`${id}`}
              name={name}
              isPlayer={false}
              hasFastestTime={false}
              position={index + 1}
              lap={2}
              classColor={16777215}
              isMultiClass={false}
              flairId={2}
              carId={id}
              dnf={false}
              repair={false}
              penalty={false}
              slowdown={false}
              config={{
                countryFlags: { enabled: false },
                gap: { enabled: false },
                badge: { enabled: false },
              } as StandingsWidgetSettings['config']}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AllCars: Story = {
  render: () => <AllCarsComponent />,
  parameters: {
    layout: 'padded',
  },
};

const IMSACarsComponent = () => {
  const imsaCars = [
    { id: 128, name: 'Dallara P217', class: 'LMP2' },
    { id: 132, name: 'BMW M4 GT3 EVO', class: 'IMSA23' },
    { id: 133, name: 'Lamborghini Huracán GT3 EVO', class: 'IMSA23' },
    { id: 156, name: 'Mercedes-AMG GT3 2020', class: 'IMSA23' },
    { id: 169, name: 'Porsche 911 GT3 R (992)', class: 'IMSA23' },
    { id: 173, name: 'Ferrari 296 GT3', class: 'IMSA23' },
    { id: 184, name: 'Chevrolet Corvette Z06 GT3.R', class: 'IMSA23' },
    { id: 185, name: 'Ford Mustang GT3', class: 'IMSA23' },
    { id: 188, name: 'McLaren 720S GT3 EVO', class: 'IMSA23' },
    { id: 194, name: 'Acura NSX GT3 EVO 22', class: 'IMSA23' },
    { id: 206, name: 'Aston Martin Vantage GT3 EVO', class: 'IMSA23' },
    { id: 159, name: 'BMW M Hybrid V8', class: 'GTP' },
    { id: 168, name: 'Cadillac V-Series.R GTP', class: 'GTP' },
    { id: 170, name: 'Acura ARX-06 GTP', class: 'GTP' },
    { id: 174, name: 'Porsche 963 GTP', class: 'GTP' },
    { id: 196, name: 'Ferrari 499P', class: 'GTP' },
  ];

  return (
    <div className="w-full h-full max-h-[90vh] overflow-y-auto">
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody>
          {imsaCars.map((car, index) => (
            <DriverInfoRow
              key={car.id}
              carIdx={index + 1}
              carNumber={`${car.id}`}
              name={car.name}
              isPlayer={false}
              hasFastestTime={false}
              position={index + 1}
              lap={2}
              classColor={16777215}
              isMultiClass={false}
              flairId={2}
              carId={car.id}
              dnf={false}
              repair={false}
              penalty={false}
              slowdown={false}
              config={{
                countryFlags: { enabled: false },
                gap: { enabled: false },
                badge: { enabled: false },
              } as StandingsWidgetSettings['config']}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const IMSACars: Story = {
  render: () => <IMSACarsComponent />,
  parameters: {
    layout: 'padded',
  },
};
