export const getTailwindColor = (
  color: number
): {
  driverIcon: string;
  classHeader: string;
} => {
  const hex = `#${color?.toString(16)}`;
  const classColorMap: Record<
    string,
    { driverIcon: string; classHeader: string }
  > = {
    '#ffda59': {
      driverIcon: 'bg-yellow-700 border-yellow-600',
      classHeader: 'bg-yellow-600 border-yellow-600',
    },
    '#33ceff': {
      driverIcon: 'bg-blue-800 border-blue-500',
      classHeader: 'bg-blue-500 border-blue-500',
    },
    '#ff5888': {
      driverIcon: 'bg-pink-800 border-pink-500',
      classHeader: 'bg-pink-500 border-pink-500',
    },
    '#ae6bff': {
      driverIcon: 'bg-purple-800 border-purple-500',
      classHeader: 'bg-purple-500 border-purple-500',
    },
    '#ffffff': {
      driverIcon: 'bg-gray-500 border-gray-400',
      classHeader: 'bg-gray-400 border-gray-400',
    },
  };

  return classColorMap[hex] ?? classColorMap['#ffffff'];
};
