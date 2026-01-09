import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeManager } from './ThemeManager';
import { useGeneralSettings, useDashboard } from '@irdashies/context';
import { useLocation } from 'react-router-dom';

// Mock the hooks
vi.mock('@irdashies/context', () => ({
  useGeneralSettings: vi.fn(),
  useDashboard: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}));

describe('ThemeManager', () => {
  const mockChildren = <div>Test Content</div>;

  it('renders children without theme wrapper when pathname starts with /settings', () => {
    // Mock the hooks
    vi.mocked(useLocation).mockReturnValue({ pathname: '/settings/general', search: '', hash: '', state: null, key: '' });
    vi.mocked(useGeneralSettings).mockReturnValue({ fontSize: 'sm' });
    vi.mocked(useDashboard).mockReturnValue({ currentProfile: null });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render children directly without the theme wrapper
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(container.querySelector('.overlay-window')).not.toBeInTheDocument();
  });

  it('renders children with theme wrapper for non-settings paths', () => {
    // Mock the hooks
    vi.mocked(useLocation).mockReturnValue({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' });
    vi.mocked(useGeneralSettings).mockReturnValue({ fontSize: 'lg' });
    vi.mocked(useDashboard).mockReturnValue({ currentProfile: null });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render children within the theme wrapper
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-lg');
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('handles undefined fontSize gracefully', () => {
    // Mock the hooks
    vi.mocked(useLocation).mockReturnValue({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' });
    vi.mocked(useGeneralSettings).mockReturnValue({});
    vi.mocked(useDashboard).mockReturnValue({ currentProfile: null });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render with default classes
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-sm');
  });

  it('handles undefined useGeneralSettings return value', () => {
    // Mock the hooks
    vi.mocked(useLocation).mockReturnValue({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' });
    vi.mocked(useGeneralSettings).mockReturnValue(undefined);
    vi.mocked(useDashboard).mockReturnValue({ currentProfile: null });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render with default classes
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-sm');
  });

  it('uses profile theme settings when available', () => {
    // Mock the hooks
    vi.mocked(useLocation).mockReturnValue({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' });
    vi.mocked(useGeneralSettings).mockReturnValue({ fontSize: 'sm', colorPalette: 'default' });
    vi.mocked(useDashboard).mockReturnValue({ 
      currentProfile: { 
        themeSettings: { 
          fontSize: 'lg', 
          colorPalette: 'dark' 
        } 
      } 
    });

    const { container } = render(<ThemeManager>{mockChildren}</ThemeManager>);

    // Should render with profile theme settings overriding general settings
    const wrapper = container.querySelector('.overlay-window');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overlay-theme-lg');
    expect(wrapper).toHaveClass('overlay-theme-color-dark');
  });
});
