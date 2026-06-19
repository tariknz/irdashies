import type { Preview } from '@storybook/react-vite';
import '../src/frontend/theme.css';

const preview: Preview = {
  globalTypes: {
    compactMode: {
      name: 'Compact',
      toolbar: {
        icon: 'collapse',
        items: [
          { value: 'off', title: 'Off' },
          { value: 'compact', title: 'Compact' },
          { value: 'ultra', title: 'Ultra' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
    compactMode: 'off',
  },
};

export default preview;
