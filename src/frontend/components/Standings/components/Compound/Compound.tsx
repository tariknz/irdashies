import React from 'react';
import '../../../../index.css'

interface CompoundProps {
  tireCompound: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}


// Size classes for the compound 
const sizeClasses = {
  sm: 'w-18 h-18',
  md: 'w-24 h-24',
  lg: 'w-48 h-48',
};

export const Compound: React.FC<CompoundProps> = ({
  tireCompound,
  className = '',
  size = 'md',
}) => {

  if (tireCompound === -1) {
    return null;
  }

  return (
    <span
      className={`fi-tire-compound fi-tire-compound-${tireCompound} ${sizeClasses[size]} ${className}`}
    />
  );
};
