export const DriverNamePreview = ({
  format,
  selected,
  onClick,
}: {
  format: string;
  selected: boolean;
  onClick: () => void;
}) => {
  const renderPreview = () => {
    switch (format) {
      case 'name-middlename-surname':
        return <div> Max Emilian Verstappen </div>;
      case 'name-m.-surname':
        return <div> Max E. Verstappen </div>;
      case 'name-surname':
        return <div> Max Verstappen </div>;
      case 'n.-surname':
        return <div> M. Verstappen </div>;
      case 'surname-n.':
        return <div> Verstappen M. </div>;
      case 'surname':
        return <div> Verstappen </div>;
      default:
        return null;
    }
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 w-full gap-2 px-3 py-1.5 text-sm font-normal rounded-md border cursor-pointer transition-colors inline-flex items-center text-left ${
        selected
          ? 'border-accent-400 bg-accent-400/10 text-accent-200'
          : 'border-settings-boundary bg-settings-control text-slate-300 hover:bg-settings-hover'
      }`}
    >
      <CheckIcon
        size={14}
        aria-hidden="true"
        className={selected ? 'shrink-0' : 'invisible shrink-0'}
      />
      {renderPreview()}
    </button>
  );
};
import { CheckIcon } from '@phosphor-icons/react';
