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
        <CarManufacturer carId={0} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">porsche:</span>
        <CarManufacturer carId={143} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ferrari:</span>
        <CarManufacturer carId={173} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">bmw:</span>
        <CarManufacturer carId={122} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">audi:</span>
        <CarManufacturer carId={176} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ford:</span>
        <CarManufacturer carId={185} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">acura:</span>
        <CarManufacturer carId={194} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mclaren:</span>
        <CarManufacturer carId={135} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">chevrolet:</span>
        <CarManufacturer carId={201} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">aston:</span>
        <CarManufacturer carId={206} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">lamborghini:</span>
        <CarManufacturer carId={133} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">honda:</span>
        <CarManufacturer carId={147} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">cadillac:</span>
        <CarManufacturer carId={168} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">skip barber:</span>
        <CarManufacturer carId={1} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">pontiac:</span>
        <CarManufacturer carId={3} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">radical:</span>
        <CarManufacturer carId={149} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">riley:</span>
        <CarManufacturer carId={21} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">scca:</span>
        <CarManufacturer carId={23} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">lotus:</span>
        <CarManufacturer carId={25} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">williams:</span>
        <CarManufacturer carId={33} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mazda:</span>
        <CarManufacturer carId={67} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">kia:</span>
        <CarManufacturer carId={44} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ruf:</span>
        <CarManufacturer carId={48} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">toyota:</span>
        <CarManufacturer carId={160} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">holden:</span>
        <CarManufacturer carId={60} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">nissan:</span>
        <CarManufacturer carId={77} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">subaru:</span>
        <CarManufacturer carId={101} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">hyundai:</span>
        <CarManufacturer carId={146} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">ligier:</span>
        <CarManufacturer carId={165} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">renault:</span>
        <CarManufacturer carId={162} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">superformula:</span>
        <CarManufacturer carId={171} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">dallara:</span>
        <CarManufacturer carId={205} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">mercedes:</span>
        <CarManufacturer carId={72} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">srx:</span>
        <CarManufacturer carId={179} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">buick:</span>
        <CarManufacturer carId={154} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white w-24">hpd:</span>
        <CarManufacturer carId={39} />
      </div>
    </div>
  ),
};
