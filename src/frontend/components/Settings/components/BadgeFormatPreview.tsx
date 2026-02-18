// Badge preview component to show different formats
export const BadgeFormatPreview = ({
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
      case 'license-color-fullrating-white':
        return (
          <div className="flex gap-1 items-center">
            <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
              B 3.8
            </div>
            <div className="bg-white/90 text-gray-700 border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1412
            </div>
          </div>
        );
      case 'fullrating-white-no-license':
        return (
          <div className="bg-white/90 text-gray-700 text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-transparent">
            1412
          </div>
        );
      case 'license-color-fullrating-bw':
        return (
          <div className="flex gap-1 items-center">
            <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
              B 3.8
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1412
            </div>
          </div>
        );
      case 'license-color-rating-bw':
        return (
          <div className="flex gap-1 items-center">
            <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
              B 3.8
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'rating-only-color-rating-bw':
        return (
          <div className="flex gap-1 items-center">
            <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
              3.8
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'license-color-rating-bw-no-license':
        return (
          <div className="flex gap-1 items-center">
            <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
              B
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'rating-color-no-license':
        return (
          <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight border-green-500 bg-green-800">
            1.4k
          </div>
        );
      case 'license-bw-rating-bw':
        return (
          <div className="flex gap-1 items-center">
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              B 3.8
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'rating-only-bw-rating-bw':
        return (
          <div className="flex gap-1 items-center">
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              3.8
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'license-bw-rating-bw-no-license':
        return (
          <div className="flex gap-1 items-center">
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              B
            </div>
            <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
              1.4k
            </div>
          </div>
        );
      case 'rating-bw-no-license':
        return (
          <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight bg-white/10 border-transparent">
            1.4k
          </div>
        );
      case 'fullrating-bw-no-license':
        return (
          <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight bg-white/10 border-transparent">
            1412
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded border cursor-pointer transition-colors inline-flex items-center justify-center ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-transparent hover:bg-slate-800'
      }`}
    >
      {renderPreview()}
    </button>
  );
};
