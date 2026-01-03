import { CaretUpIcon, CaretDownIcon, MinusIcon } from '@phosphor-icons/react';

interface RatingChangeProps {
  value?: number;
}

export const RatingChange = ({ value }: RatingChangeProps) => {
  if (value === undefined || isNaN(value)) {
    return <span className="text-gray-400">
      <MinusIcon size={10} />
    </span>;
  }

  const roundedChange = Math.round(value);
  let text: string;
  let color = 'text-gray-400';
  let icon: React.ReactNode;

  if (roundedChange > 0) {
    text = `${roundedChange}`;
    color = 'text-green-400';
    icon = <CaretUpIcon size={10} />;
  } else if (roundedChange < 0) {
    text = `${Math.abs(roundedChange)}`;
    color = 'text-red-400';
    icon = <CaretDownIcon size={10} />;
  } else {
    text = `${roundedChange}`;
    icon = <MinusIcon size={10} />;
  }

  return (
    <span className={`flex items-center justify-center gap-0.5 ${color}`}>
      {icon}
      {text}
    </span>
  );
}; 