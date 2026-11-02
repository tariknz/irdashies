import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StorageStatusNotice } from './StorageStatusNotice';

const meta: Meta<typeof StorageStatusNotice> = {
  title: 'components/Settings/StorageStatusNotice',
  component: StorageStatusNotice,
  decorators: [
    (Story) => {
      const previous = window.storageStatusBridge;
      window.storageStatusBridge = {
        onStatus: (callback) => {
          callback({ diskFull: true });
          return () => undefined;
        },
      };
      useEffect(
        () => () => {
          window.storageStatusBridge = previous;
        },
        [previous]
      );
      return (
        <div className="bg-slate-700 p-4">
          <Story />
        </div>
      );
    },
  ],
};
export default meta;
export const DiskFull: StoryObj<typeof meta> = {};
