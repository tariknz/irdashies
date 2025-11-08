import type { Meta, StoryObj } from '@storybook/react-vite';
import { CarManufacturer } from './CarManufacturer';

const meta: Meta<typeof CarManufacturer> = {
  component: CarManufacturer,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    carId: {
      control: { type: 'number' },
      description: 'carID data',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the compound',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllManufacturers: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-4">
        <span className="text-white w-24">unknown:</span>
        <CarManufacturer carId={0} size="sm" />
        <CarManufacturer carId={0} size="md" />
        <CarManufacturer carId={0} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">porsche:</span>
        <CarManufacturer carId={143} size="sm" />
        <CarManufacturer carId={143} size="md" />
        <CarManufacturer carId={143} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ferrari:</span>
        <CarManufacturer carId={173} size="sm" />
        <CarManufacturer carId={173} size="md" />
        <CarManufacturer carId={173} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">bmw:</span>
        <CarManufacturer carId={122} size="sm" />
        <CarManufacturer carId={122} size="md" />
        <CarManufacturer carId={122} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">audi:</span>
        <CarManufacturer carId={176} size="sm" />
        <CarManufacturer carId={176} size="md" />
        <CarManufacturer carId={176} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ford:</span>
        <CarManufacturer carId={185} size="sm" />
        <CarManufacturer carId={185} size="md" />
        <CarManufacturer carId={185} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">acura:</span>
        <CarManufacturer carId={194} size="sm" />
        <CarManufacturer carId={194} size="md" />
        <CarManufacturer carId={194} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mclaren:</span>
        <CarManufacturer carId={135} size="sm" />
        <CarManufacturer carId={135} size="md" />
        <CarManufacturer carId={135} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">chevrolet:</span>
        <CarManufacturer carId={201} size="sm" />
        <CarManufacturer carId={201} size="md" />
        <CarManufacturer carId={201} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">aston:</span>
        <CarManufacturer carId={206} size="sm" />
        <CarManufacturer carId={206} size="md" />
        <CarManufacturer carId={206} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">lamborghini:</span>
        <CarManufacturer carId={133} size="sm" />
        <CarManufacturer carId={133} size="md" />
        <CarManufacturer carId={133} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">honda:</span>
        <CarManufacturer carId={147} size="sm" />
        <CarManufacturer carId={147} size="md" />
        <CarManufacturer carId={147} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">cadillac:</span>
        <CarManufacturer carId={168} size="sm" />
        <CarManufacturer carId={168} size="md" />
        <CarManufacturer carId={168} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">skip barber:</span>
        <CarManufacturer carId={1} size="sm" />
        <CarManufacturer carId={1} size="md" />
        <CarManufacturer carId={1} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">pontiac:</span>
        <CarManufacturer carId={3} size="sm" />
        <CarManufacturer carId={3} size="md" />
        <CarManufacturer carId={3} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">radical:</span>
        <CarManufacturer carId={149} size="sm" />
        <CarManufacturer carId={149} size="md" />
        <CarManufacturer carId={149} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">riley:</span>
        <CarManufacturer carId={21} size="sm" />
        <CarManufacturer carId={21} size="md" />
        <CarManufacturer carId={21} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">scca:</span>
        <CarManufacturer carId={23} size="sm" />
        <CarManufacturer carId={23} size="md" />
        <CarManufacturer carId={23} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">lotus:</span>
        <CarManufacturer carId={25} size="sm" />
        <CarManufacturer carId={25} size="md" />
        <CarManufacturer carId={25} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">williams:</span>
        <CarManufacturer carId={33} size="sm" />
        <CarManufacturer carId={33} size="md" />
        <CarManufacturer carId={33} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mazda:</span>
        <CarManufacturer carId={67} size="sm" />
        <CarManufacturer carId={67} size="md" />
        <CarManufacturer carId={67} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">kia:</span>
        <CarManufacturer carId={44} size="sm" />
        <CarManufacturer carId={44} size="md" />
        <CarManufacturer carId={44} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ruf:</span>
        <CarManufacturer carId={48} size="sm" />
        <CarManufacturer carId={48} size="md" />
        <CarManufacturer carId={48} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">toyota:</span>
        <CarManufacturer carId={160} size="sm" />
        <CarManufacturer carId={160} size="md" />
        <CarManufacturer carId={160} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">holden:</span>
        <CarManufacturer carId={60} size="sm" />
        <CarManufacturer carId={60} size="md" />
        <CarManufacturer carId={60} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">nissan:</span>
        <CarManufacturer carId={77} size="sm" />
        <CarManufacturer carId={77} size="md" />
        <CarManufacturer carId={77} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">subaru:</span>
        <CarManufacturer carId={101} size="sm" />
        <CarManufacturer carId={101} size="md" />
        <CarManufacturer carId={101} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">hyundai:</span>
        <CarManufacturer carId={146} size="sm" />
        <CarManufacturer carId={146} size="md" />
        <CarManufacturer carId={146} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ligier:</span>
        <CarManufacturer carId={165} size="sm" />
        <CarManufacturer carId={165} size="md" />
        <CarManufacturer carId={165} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">renault:</span>
        <CarManufacturer carId={162} size="sm" />
        <CarManufacturer carId={162} size="md" />
        <CarManufacturer carId={162} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">superformula:</span>
        <CarManufacturer carId={171} size="sm" />
        <CarManufacturer carId={171} size="md" />
        <CarManufacturer carId={171} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">dallara:</span>
        <CarManufacturer carId={205} size="sm" />
        <CarManufacturer carId={205} size="md" />
        <CarManufacturer carId={205} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mercedes:</span>
        <CarManufacturer carId={72} size="sm" />
        <CarManufacturer carId={72} size="md" />
        <CarManufacturer carId={72} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">srx:</span>
        <CarManufacturer carId={179} size="sm" />
        <CarManufacturer carId={179} size="md" />
        <CarManufacturer carId={179} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">buick:</span>
        <CarManufacturer carId={154} size="sm" />
        <CarManufacturer carId={154} size="md" />
        <CarManufacturer carId={154} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">hpd:</span>
        <CarManufacturer carId={39} size="sm" />
        <CarManufacturer carId={39} size="md" />
        <CarManufacturer carId={39} size="lg" />
      </div>
    </div>
  ),
};