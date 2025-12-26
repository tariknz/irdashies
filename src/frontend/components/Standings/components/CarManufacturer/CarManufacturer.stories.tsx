import type { Meta, StoryObj } from '@storybook/react-vite';
import { CarManufacturer } from './CarManufacturer';
import { CAR_ID_TO_CAR_MANUFACTURER } from './carManufacturerMapping';

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

export const AllCars: Story = {
  render: () => {
    const carEntries = Object.entries(CAR_ID_TO_CAR_MANUFACTURER)
      .map(([id, data]) => ({ id: Number(id), ...data }))
      .sort((a, b) => a.id - b.id);

    return (
      <div className="p-4 bg-slate-800 rounded-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4 sticky top-0 bg-slate-800 pb-2">
          All Cars ({carEntries.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {carEntries.map(({ id, name, manufacturer }) => (
            <div
              key={id}
              className="flex items-center gap-3 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
            >
              <div className="flex-shrink-0">
                <CarManufacturer carId={id} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate" title={name}>
                  {name}
                </div>
                <div className="text-slate-400 text-xs">
                  ID: {id} • {manufacturer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

export const AllCarsByManufacturer: Story = {
  render: () => {
    const carEntries = Object.entries(CAR_ID_TO_CAR_MANUFACTURER)
      .map(([id, data]) => ({ id: Number(id), ...data }))
      .sort((a, b) => a.id - b.id);

    const groupedByManufacturer = carEntries.reduce(
      (acc, car) => {
        const manufacturer = car.manufacturer;
        if (!acc[manufacturer]) {
          acc[manufacturer] = [];
        }
        acc[manufacturer].push(car);
        return acc;
      },
      {} as Record<string, typeof carEntries>,
    );

    const sortedManufacturers = Object.keys(groupedByManufacturer).sort();

    return (
      <div className="p-4 bg-slate-800 rounded-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4 sticky top-0 bg-slate-800 pb-2">
          All Cars by Manufacturer
        </h2>
        <div className="space-y-6">
          {sortedManufacturers.map((manufacturer) => (
            <div key={manufacturer} className="border-b border-slate-600 pb-4 last:border-0">
              <h3 className="text-white text-lg font-semibold mb-3 capitalize">
                {manufacturer} ({groupedByManufacturer[manufacturer].length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {groupedByManufacturer[manufacturer].map(({ id, name }) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <CarManufacturer carId={id} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate" title={name}>
                        {name}
                      </div>
                      <div className="text-slate-400 text-xs">ID: {id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

export const UnknownManufacturerCars: Story = {
  render: () => {
    const unknownCars = Object.entries(CAR_ID_TO_CAR_MANUFACTURER)
      .map(([id, data]) => ({ id: Number(id), ...data }))
      .filter((car) => car.manufacturer === 'unknown')
      .sort((a, b) => a.id - b.id);

    return (
      <div className="p-4 bg-slate-800 rounded-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4 sticky top-0 bg-slate-800 pb-2">
          Unknown Manufacturer Cars ({unknownCars.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {unknownCars.map(({ id, name }) => (
            <div
              key={id}
              className="flex items-center gap-3 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
            >
              <div className="flex-shrink-0">
                <CarManufacturer carId={id} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate" title={name}>
                  {name}
                </div>
                <div className="text-slate-400 text-xs">ID: {id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};
