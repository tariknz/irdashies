import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import { RadarPoleSideKey } from './RadarPoleSideKey';

const meta: Meta<typeof RadarPoleSideKey> = {
  component: RadarPoleSideKey,
  title: 'components/Settings/RadarSettings/RadarPoleSideKey',
  decorators: [
    (Story) => {
      // The row reads its binding through the preload bridge.
      Object.defineProperty(window, 'keybindingsBridge', {
        configurable: true,
        writable: true,
        value: {
          getKeybindings: async () => ({ ...DEFAULT_KEYBINDINGS }),
          updateKeybinding: async () => ({ ...DEFAULT_KEYBINDINGS }),
          resetKeybinding: async () => ({ ...DEFAULT_KEYBINDINGS }),
          resetAllKeybindings: async () => ({ ...DEFAULT_KEYBINDINGS }),
          startRecording: async () => undefined,
          stopRecording: async () => undefined,
          onGamepadCaptured: () => () => undefined,
        },
      });
      return (
        <div style={{ width: '600px' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default meta;

export const Default: StoryObj<typeof RadarPoleSideKey> = {};
