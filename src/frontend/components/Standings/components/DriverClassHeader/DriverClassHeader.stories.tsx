import { Meta, StoryObj } from '@storybook/react-vite';
import { DriverClassHeader } from './DriverClassHeader';

const TableWrapper = ({ children }: { children: React.ReactNode }) => (
  <table className="text-white text-sm">
    <tbody>{children}</tbody>
  </table>
);

export default {
  component: DriverClassHeader,
  title: 'widgets/Standings/components/DriverClassHeader',
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof DriverClassHeader>;

export const Default: Story = {
  args: {
    className: 'GTE',
    classColor: 0x00d4ff,
    totalDrivers: 12,
    sof: 2432,
    isMultiClass: true,
    classHeaderStyle: { compactSof: false },
    manufacturerCounts: [
      { carId: 56, count: 7 },
      { carId: 122, count: 5 },
    ],
  },
};

export const CompactSoF: Story = {
  args: {
    className: 'GTE',
    classColor: 0x00d4ff,
    totalDrivers: 12,
    sof: 2432,
    isMultiClass: true,
    classHeaderStyle: { compactSof: true },
    manufacturerCounts: [
      { carId: 56, count: 7 },
      { carId: 122, count: 5 },
    ],
  },
};

export const SingleMake: Story = {
  args: {
    className: 'Porsche Cup',
    classColor: 0xff0000,
    totalDrivers: 10,
    sof: 1850,
    isMultiClass: true,
    classHeaderStyle: { compactSof: false },
    manufacturerCounts: [{ carId: 160, count: 10 }],
  },
};

export const ManyManufacturers: Story = {
  args: {
    className: 'GT3',
    classColor: 0x00aa44,
    totalDrivers: 18,
    sof: 3100,
    isMultiClass: true,
    classHeaderStyle: { compactSof: true },
    manufacturerCounts: [
      { carId: 56, count: 5 },
      { carId: 122, count: 4 },
      { carId: 145, count: 3 },
      { carId: 160, count: 3 },
      { carId: 1, count: 2 },
      { carId: 3, count: 1 },
    ],
  },
};

export const AllClasses: Story = {
  render: () => (
    <TableWrapper>
      <DriverClassHeader
        className="GTE"
        classColor={0x00d4ff}
        totalDrivers={12}
        sof={2432}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: false }}
        manufacturerCounts={[
          { carId: 56, count: 7 },
          { carId: 122, count: 5 },
        ]}
      />
      <DriverClassHeader
        className="GTE (compact SoF)"
        classColor={0x00d4ff}
        totalDrivers={12}
        sof={2432}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
        manufacturerCounts={[
          { carId: 56, count: 7 },
          { carId: 122, count: 5 },
        ]}
      />
      <DriverClassHeader
        className="LMP2 (single make)"
        classColor={0xff6600}
        totalDrivers={8}
        sof={850}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
        manufacturerCounts={[{ carId: 56, count: 8 }]}
      />
      <DriverClassHeader
        className="LMP1"
        classColor={0xffd700}
        totalDrivers={5}
        sof={12540}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
        manufacturerCounts={[
          { carId: 56, count: 3 },
          { carId: 145, count: 2 },
        ]}
      />
    </TableWrapper>
  ),
};
