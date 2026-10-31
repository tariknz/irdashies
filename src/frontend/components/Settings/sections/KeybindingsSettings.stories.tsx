import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge, TelemetryDecorator } from '@irdashies/storybook';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';
import type {
  KeybindingsBridge,
  KeybindingsMap,
  StaticKeybindingActionId,
  KeybindingEntry,
  KeybindingRegistrationStatuses,
} from '@irdashies/types';
import { KeybindingsSettings } from './KeybindingsSettings';

/** Deterministic OS outcomes, including saved shortcuts that fail at startup. */
const mockKeybindings =
  (
    initialStatuses: KeybindingRegistrationStatuses = {},
    overrides: Partial<Record<StaticKeybindingActionId, KeybindingEntry>> = {}
  ) =>
  () => {
    const original = window.keybindingsBridge;
    let statuses = structuredClone(initialStatuses);
    let bindings: KeybindingsMap = {
      ...structuredClone(DEFAULT_KEYBINDINGS),
      ...overrides,
    };
    window.keybindingsBridge = {
      getKeybindings: async () => bindings,
      getRegistrationStatuses: async () => statuses,
      updateKeybinding: async (actionId, accelerator) => {
        // F8 simulates an OS refusal while recording; the original binding stays.
        if (accelerator === 'F8')
          return { ok: false, message: KEYBINDING_MESSAGES.unavailable };
        bindings = {
          ...bindings,
          [actionId]: { ...bindings[actionId], accelerator, isDefault: false },
        };
        statuses = Object.fromEntries(
          Object.entries(statuses).filter(([id]) => id !== actionId)
        );
        return { ok: true, bindings };
      },
      resetKeybinding: async (actionId) => {
        bindings = { ...bindings, [actionId]: DEFAULT_KEYBINDINGS[actionId] };
        return bindings;
      },
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
  beforeEach: mockKeybindings({
    'toggle-hide-ui': {
      status: 'unavailable',
      message: KEYBINDING_MESSAGES.unavailable,
    },
  }),
};
export const PersistedInvalid: Story = {
  beforeEach: mockKeybindings(
    {
      'toggle-hide-ui': {
        status: 'invalid',
        message: KEYBINDING_MESSAGES.invalid,
      },
    },
    {
      'toggle-hide-ui': {
        ...DEFAULT_KEYBINDINGS['toggle-hide-ui'],
        accelerator: 'Pause',
        isDefault: false,
      },
    }
  ),
};
export const PersistedDuplicate: Story = {
  beforeEach: mockKeybindings(
    {
      'toggle-edit-mode': {
        status: 'duplicate',
        message:
          'Shortcut already bound to "Hide / Show UI" in irDashies. Choose another combination.',
      },
    },
    {
      'toggle-edit-mode': {
        ...DEFAULT_KEYBINDINGS['toggle-edit-mode'],
        accelerator: 'Alt+H',
        isDefault: false,
      },
    }
  ),
};
export const UnexpectedRegistrationError: Story = {
  beforeEach: mockKeybindings({
    'toggle-hide-ui': { status: 'error', message: KEYBINDING_MESSAGES.error },
  }),
};
