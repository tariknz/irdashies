import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RotationIndicator } from './RotationIndicator';

describe('RotationIndicator', () => {
  it('should not render when angle is within normal range', () => {
    const { container } = render(<RotationIndicator currentAngleRad={0} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render when angle is at threshold', () => {
    const { container } = render(<RotationIndicator currentAngleRad={270 * (Math.PI / 180)} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render when angle exceeds threshold clockwise', () => {
    render(<RotationIndicator currentAngleRad={280 * (Math.PI / 180)} />);
    
    expect(screen.getByText('280°')).toBeInTheDocument();
  });

  it('should render when angle exceeds threshold counterclockwise', () => {
    render(<RotationIndicator currentAngleRad={-280 * (Math.PI / 180)} />);
    
    expect(screen.getByText('280°')).toBeInTheDocument();
  });

  it('should render with extreme angle', () => {
    render(<RotationIndicator currentAngleRad={350 * (Math.PI / 180)} />);
    
    expect(screen.getByText('350°')).toBeInTheDocument();
  });
}); 