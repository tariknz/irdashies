// Badge preview component to show different formats
export const DriverNamePreview = ({
  format,
  selected,
  onClick
}: {
  format: string;
  selected: boolean;
  onClick: () => void;
}) => {
  const renderPreview = () => {
    switch (format) {
      case 'name-middlename-surname':
        return <div> Max Emilian Vertappen </div>;
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
      onClick={onClick}
      className={`px-3 py-1 rounded cursor-pointer transition-colors inline-flex items-center justify-center ${
        selected
          ? 'border border-blue-500 bg-blue-500/10'
          : 'hover:bg-slate-800'
      }`}
    >
      {renderPreview()}
    </button>
  );
};
