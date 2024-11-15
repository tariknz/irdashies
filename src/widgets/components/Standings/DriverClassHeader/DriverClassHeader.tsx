import { getTailwindColor } from '../../../utils/telemetryUtils';

type DriverClassHeaderProps = {
  className: string;
  classColor: number;
};

export const DriverClassHeader = ({
  className,
  classColor,
}: DriverClassHeaderProps) => {
  if (!className) {
    return (
      <tr>
        <td colSpan={6} className="pb-3"></td>
      </tr>
    );
  }

  return (
    <tr>
      <td></td>
      <td colSpan={4} className="p-0">
        <div
          className={`[text-shadow:_1px_1px_0px_rgb(0_0_0)] font-bold mt-3 px-2 py-1 inline-block border-l-4 ${getTailwindColor(classColor).classHeader}`}
        >
          {className}
        </div>
      </td>
    </tr>
  );
};
