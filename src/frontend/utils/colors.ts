export const getTailwindColor = (
  color?: number
): {
  driverIcon: string;
  classHeader: string;
  fill: string;
} => {
  const hex = `#${color?.toString(16)}`;
  const classColorMap: Record<
    string,
    { driverIcon: string; classHeader: string; fill: string }
  > = {
    '#ffda59': {
      driverIcon: 'bg-orange-800 border-orange-500',
      classHeader: 'bg-orange-500 border-orange-500',
      fill: 'fill-orange-500',
    },
    '#33ceff': {
      driverIcon: 'bg-blue-800 border-blue-500',
      classHeader: 'bg-blue-500 border-blue-500',
      fill: 'fill-blue-500',
    },
    '#ff5888': {
      driverIcon: 'bg-pink-800 border-pink-500',
      classHeader: 'bg-pink-500 border-pink-500',
      fill: 'fill-pink-500',
    },
    '#ae6bff': {
      driverIcon: 'bg-purple-800 border-purple-500',
      classHeader: 'bg-purple-500 border-purple-500',
      fill: 'fill-purple-500',
    },
    '#ffffff': {
      driverIcon: 'bg-sky-800 border-sky-500',
      classHeader: 'bg-sky-500 border-sky-500',
      fill: 'fill-sky-500',
    },
  };

  return classColorMap[hex] ?? classColorMap['#ffffff'];
};
