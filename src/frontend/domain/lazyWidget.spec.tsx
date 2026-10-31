import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazyWidget } from './lazyWidget';

describe('lazy widget registration', () => {
  it('defers implementation loading until mounted and forwards changing props', async () => {
    const load = vi.fn(async () => ({
      default: ({ label }: { label: string }) => <div>{label}</div>,
    }));
    const Widget = lazyWidget(load);
    expect(load).not.toHaveBeenCalled();
    const { rerender } = render(<Widget label="First instance" />);
    expect(await screen.findByText('First instance')).toBeInTheDocument();
    rerender(<Widget label="Updated instance" />);
    expect(screen.getByText('Updated instance')).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
  });
});
