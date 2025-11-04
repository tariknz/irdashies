import React from 'react';
import tireCompoundImage from '../../../../assets/img/tire_compound.png';

interface CompoundProps {
  tireCompound: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}


// Size classes for the compound 
const sizeClasses = {
  sm: 'text-[1em]',
  md: 'text-[1.5em]',
  lg: 'text-[2em]',
};

const compoundPositions: Record<number, { x: string; y: string }> = {
  0: { x: '0', y: '0' },
  1: { x: '0', y: '25%' },
};

export const Compound: React.FC<CompoundProps> = ({
  tireCompound,
  className = '',
  size = 'md',
}) => {

  if (tireCompound < 0) {
    return null;
  }

  const position = compoundPositions[tireCompound];


  return (
    <span
      className={`inline-block w-[1em] h-[1em] bg-no-repeat bg-size-[100%_auto] ${sizeClasses[size]} ${className}`}
      style={{
        backgroundImage: `url(${tireCompoundImage})`,
        backgroundPosition: position ? `${position.x} ${position.y}` : '0 0',
      }}
    />
  );
};
