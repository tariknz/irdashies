import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingToggleRow } from './SettingToggleRow';
import { ToggleSwitch } from './ToggleSwitch';

describe('SettingToggleRow', () => {
  it('names the switch without rendering the title twice', () => {
    // The row already shows the title beside the switch. Passing it as the
    // switch's visible label as well rendered a second copy and squeezed the
    // toggle, but the accessible name still has to survive, or the switch
    // becomes an unnamed control in the settings list.
    render(
      <SettingToggleRow
        title="Show pit stops"
        description="Adds the pit stop column"
        enabled
        onToggle={vi.fn()}
      />
    );

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(1);
    expect(switches[0]).toHaveAccessibleName('Show pit stops');
    expect(screen.getAllByText('Show pit stops')).toHaveLength(1);
  });
});

describe('ToggleSwitch', () => {
  it('renders a visible label and names the switch from it', () => {
    render(
      <ToggleSwitch enabled={false} onToggle={vi.fn()} label="Lap delta" />
    );

    expect(screen.getByRole('switch')).toHaveAccessibleName('Lap delta');
    expect(screen.getByText('Lap delta')).toBeInTheDocument();
  });

  it('prefers ariaLabel over label for the name when both are given', () => {
    render(
      <ToggleSwitch
        enabled={false}
        onToggle={vi.fn()}
        label="Visible"
        ariaLabel="Spoken"
      />
    );

    expect(screen.getByRole('switch')).toHaveAccessibleName('Spoken');
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });
});
