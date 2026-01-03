import type { Preview } from '@storybook/react-vite';
import '../src/frontend/theme.css';

const preview: Preview = {
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
};

export default preview;
