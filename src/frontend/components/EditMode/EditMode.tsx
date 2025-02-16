import { PropsWithChildren } from 'react';
import { useDashboard } from '@irdashies/context';
import { Resize } from '@phosphor-icons/react';

export const EditMode = ({ children }: PropsWithChildren) => {
  const { editMode } = useDashboard();
  if (editMode) {
    return (
      <div className="relative w-full h-full">
        <div className="animate-pulse-border z-20 absolute w-full h-full border-solid border-2 border-sky-500 cursor-move">
          <div className="flex items-center gap-2 absolute top-0 right-0 py-1 px-2 bg-sky-500 text-white cursor-move">
            <Resize /> <span>Edit Mode</span>
          </div>
        </div>
        {children}
      </div>
    );
  }
  return <>{children}</>;
};
