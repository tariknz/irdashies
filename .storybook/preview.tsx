import type { Preview } from '@storybook/react';
import '../src/frontend/theme.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export default preview;
