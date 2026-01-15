export type DriverNameParts = {
  firstName: string;
  middleName: string | null;
  surname: string;
};

// Utility: capitalize the first letter of each word
const capitalizeWords = (str: string) =>
  str
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

export const extractDriverName = (
  fullName: string = ''
): DriverNameParts => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', middleName: null, surname: '' };
  }

  if (parts.length === 1) {
    return {
      firstName: capitalizeWords(parts[0]),
      middleName: null,
      surname: '',
    };
  }

  return {
    firstName: capitalizeWords(parts[0]),
    middleName:
      parts.length > 2
        ? capitalizeWords(parts.slice(1, -1).join(' '))
        : null,
    surname: capitalizeWords(parts[parts.length - 1]),
  };
};

export type DriverNameFormat =
  | 'name-middlename-surname'
  | 'name-m.-surname'
  | 'name-surname'
  | 'n.-surname'
  | 'surname-n.'
  | 'surname';

export const DriverName = (
  name: DriverNameParts,
  format: DriverNameFormat
): string => {
  const { firstName, middleName, surname } = name;
  const middleInitial = middleName?.charAt(0);

  switch (format) {
    case 'name-middlename-surname':
      return [firstName, middleName, surname].filter(Boolean).join(' ');

    case 'name-m.-surname':
      return [firstName, middleInitial && `${middleInitial}.`, surname]
        .filter(Boolean)
        .join(' ');

    case 'name-surname':
      return [firstName, surname].join(' ');

    case 'n.-surname':
      return `${firstName.charAt(0)}. ${surname}`;

    case 'surname-n.':
      return `${surname} ${firstName.charAt(0)}.`;

    case 'surname':
      return surname;

    default:
      return `${firstName} ${surname}`;
  }
};
