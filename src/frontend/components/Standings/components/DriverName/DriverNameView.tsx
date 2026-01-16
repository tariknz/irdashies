import React from 'react';
import { extractDriverName, DriverName, DriverNameFormat } from './DriverName';

export type DriverNameViewProps = {
  fullName?: string;
  format: DriverNameFormat;
};

// This component lets us render DriverName in JSX / Storybook
export const DriverNameView: React.FC<DriverNameViewProps> = ({
  fullName = '',
  format,
}) => {
  const parts = extractDriverName(fullName);
  const formatted = DriverName(parts, format);

  return <span>{formatted}</span>;
};
