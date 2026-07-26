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
  },
};

export const LowSoF: Story = {
  args: {
    className: 'LMP2',
    classColor: 0xff6600,
    totalDrivers: 8,
    sof: 850,
    isMultiClass: true,
    classHeaderStyle: { compactSof: true },
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
      />
      <DriverClassHeader
        className="GTE"
        classColor={0x00d4ff}
        totalDrivers={12}
        sof={2432}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
      />
      <DriverClassHeader
        className="LMP2"
        classColor={0xff6600}
        totalDrivers={8}
        sof={850}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
      />
      <DriverClassHeader
        className="LMP1"
        classColor={0xffd700}
        totalDrivers={5}
        sof={12540}
        isMultiClass={true}
        classHeaderStyle={{ compactSof: true }}
      />
    </TableWrapper>
  ),
};
