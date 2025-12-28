import type { Meta, StoryObj } from '@storybook/react-vite';
import { CarManufacturer } from './CarManufacturer';
import { CAR_ID_TO_CAR_MANUFACTURER } from './carManufacturerMapping';

const meta: Meta<typeof CarManufacturer> = {
  component: CarManufacturer,
  title: 'widgets/Standings/components/CarManufacturer',
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
  render: () => {
    const manufacturerToCarId = new Map<string, number>();
    
    Object.entries(CAR_ID_TO_CAR_MANUFACTURER).forEach(([carId, data]) => {
      const manufacturer = data.manufacturer;
      if (!manufacturerToCarId.has(manufacturer)) {
        manufacturerToCarId.set(manufacturer, Number(carId));
      }
    });

    const sortedManufacturers = Array.from(manufacturerToCarId.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedManufacturers.map(([manufacturer, carId]) => (
          <div key={manufacturer} className="flex items-center gap-2">
            <CarManufacturer carId={carId} />
            <span>{manufacturer}</span>
          </div>
        ))}
      </div>
    );
  },
};

export const AllCars: Story = {
  render: () => {
    const carEntries = Object.entries(CAR_ID_TO_CAR_MANUFACTURER)
      .map(([id, data]) => ({ id: Number(id), ...data }))
      .sort((a, b) => a.id - b.id);

    return (
      <div className="p-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          All Cars ({carEntries.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {carEntries.map(({ id, name, manufacturer }) => (
            <div key={id} className="flex items-center gap-3 p-2">
              <div className="shrink-0">
                <CarManufacturer carId={id} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={name}>
                  {name}
                </div>
                <div className="text-xs">
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
      <div className="p-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          All Cars by Manufacturer
        </h2>
        <div className="space-y-6">
          {sortedManufacturers.map((manufacturer) => (
            <div key={manufacturer} className="pb-4">
              <h3 className="text-lg font-semibold mb-3 capitalize">
                {manufacturer} ({groupedByManufacturer[manufacturer].length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {groupedByManufacturer[manufacturer].map(({ id, name }) => (
                  <div key={id} className="flex items-center gap-2 p-2">
                    <div className="shrink-0">
                      <CarManufacturer carId={id} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" title={name}>
                        {name}
                      </div>
                      <div className="text-xs">ID: {id}</div>
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
      <div className="p-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Unknown Manufacturer Cars ({unknownCars.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {unknownCars.map(({ id, name }) => (
            <div key={id} className="flex items-center gap-3 p-2">
              <div className="shrink-0">
                <CarManufacturer carId={id} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={name}>
                  {name}
                </div>
                <div className="text-xs">ID: {id}</div>
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
