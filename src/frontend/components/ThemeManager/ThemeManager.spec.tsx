import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeManager } from './ThemeManager';
import { useGeneralSettings } from '@irdashies/context';

// Mock the hooks
vi.mock('@irdashies/context', () => ({
  useGeneralSettings: vi.fn(),
}));

describe('ThemeManager', () => {
  const mockChildren = <div>Test Content</div>;
  const originalHash = window.location.hash;

  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('renders children without theme wrapper when hash starts with #/settings', () => {
    window.location.hash = '#/settings/general';
    vi.mocked(useGeneralSettings).mockReturnValue({ fontSize: 'sm' });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render children directly without the theme wrapper
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(container.querySelector('.overlay-window')).not.toBeInTheDocument();
  });

  it('renders children with theme wrapper for non-settings paths', () => {
    window.location.hash = '';
    vi.mocked(useGeneralSettings).mockReturnValue({ fontSize: 'lg' });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render children within the theme wrapper
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-lg');
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('handles undefined fontSize gracefully', () => {
    window.location.hash = '';
    vi.mocked(useGeneralSettings).mockReturnValue({});

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render with default classes
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-sm');
  });

  it('handles undefined useGeneralSettings return value', () => {
    window.location.hash = '';
    vi.mocked(useGeneralSettings).mockReturnValue(undefined);

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render with default classes
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-sm');
  });
});
