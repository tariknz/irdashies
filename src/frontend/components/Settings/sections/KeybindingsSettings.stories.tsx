import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge, TelemetryDecorator } from '@irdashies/storybook';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';
import type { KeybindingsBridge } from '@irdashies/types';
import { KeybindingsSettings } from './KeybindingsSettings';

const mockKeybindings =
  (unavailable = false) =>
  () => {
    const original = window.keybindingsBridge;
    let bindings = structuredClone(DEFAULT_KEYBINDINGS);
    window.keybindingsBridge = {
      getKeybindings: async () => bindings,
      getRegistrationErrors: async () =>
        unavailable
          ? {
              'toggle-hide-ui': KEYBINDING_MESSAGES.unavailable,
            }
          : {},
      updateKeybinding: async (id, accelerator) => {
        if (accelerator === 'F8')
          return { error: KEYBINDING_MESSAGES.unavailable };
        bindings = {
          ...bindings,
          [id]: { ...bindings[id], accelerator, isDefault: false },
        };
        unavailable = false;
        return bindings;
      },
      resetKeybinding: async () =>
        (bindings = structuredClone(DEFAULT_KEYBINDINGS)),
      resetAllKeybindings: async () =>
        (bindings = structuredClone(DEFAULT_KEYBINDINGS)),
      startRecording: async () => undefined,
      stopRecording: async () => undefined,
      onGamepadCaptured: () => () => undefined,
    } satisfies KeybindingsBridge;
    return () => {
      window.keybindingsBridge = original;
    };
  };

const meta: Meta<typeof KeybindingsSettings> = {
  component: KeybindingsSettings,
  title: 'components/Settings/KeybindingsSettings',
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <div className="h-screen w-[600px]">
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof KeybindingsSettings>;
export const Default: Story = { beforeEach: mockKeybindings() };
export const PersistedUnavailable: Story = {
  beforeEach: mockKeybindings(true),
};
