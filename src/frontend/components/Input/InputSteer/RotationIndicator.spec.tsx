import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RotationIndicator } from './RotationIndicator';

describe('RotationIndicator', () => {
  it('should render with zero degrees', () => {
    render(<RotationIndicator currentAngleRad={0} />);
    
    expect(screen.getByText('0°')).toBeInTheDocument();
  });

  it('should show correct angle in degrees', () => {
    render(<RotationIndicator currentAngleRad={Math.PI / 2} />);
    
    expect(screen.getByText('-90°')).toBeInTheDocument();
  });

  it('should show negative angle in degrees', () => {
    render(<RotationIndicator currentAngleRad={-Math.PI / 4} />);
    
    expect(screen.getByText('45°')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RotationIndicator currentAngleRad={0} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
}); 