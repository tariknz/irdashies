import { useTelemetry, useSessionDrivers } from '@irdashies/context';

export const DebugCarIdxPosition = () => {
  const carIdxPosition = useTelemetry('CarIdxPosition');
  const carIdxEstTime = useTelemetry('CarIdxEstTime');
  const carIdxLapDistPct = useTelemetry('CarIdxLapDistPct');
  const sessionDrivers = useSessionDrivers();

  if (!carIdxPosition?.value || !sessionDrivers) {
    return <div>Loading telemetry data...</div>;
  }

  // Filter out invalid car indices (typically -1 values)
  const validCars = carIdxPosition.value
    .map((position, index) => ({
      carIdx: index,
      position,
      estTime: carIdxEstTime?.value?.[index],
      lapDistPct: carIdxLapDistPct?.value?.[index],
      driver: sessionDrivers.find(d => d.CarIdx === index)
    }))
    .filter(car => car.position > 0 && car.driver);

  // Sort by position
  validCars.sort((a, b) => a.position - b.position);

  return (
    <div className="p-4 bg-gray-800 text-white rounded overflow-auto max-h-[80vh]">
      <h2 className="text-xl font-bold mb-4">Debug CarIdxPosition Data</h2>
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="bg-gray-700">
            <th className="p-2 text-left">Car#</th>
            <th className="p-2 text-left">Driver</th>
            <th className="p-2 text-left">Idx</th>
            <th className="p-2 text-left">Position</th>
            <th className="p-2 text-left">Lap Dist %</th>
            <th className="p-2 text-left">Est Time</th>
          </tr>
        </thead>
        <tbody>
          {validCars.map((car) => (
            <tr key={car.carIdx} className="border-b border-gray-700">
              <td className="p-2">{car.driver?.CarNumber}</td>
              <td className="p-2">{car.driver?.UserName}</td>
              <td className="p-2">{car.carIdx}</td>
              <td className="p-2">{car.position}</td>
              <td className="p-2">{car.lapDistPct?.toFixed(3)}</td>
              <td className="p-2">{car.estTime?.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 