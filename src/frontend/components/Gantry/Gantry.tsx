import { memo } from 'react';

export const Gantry = memo(() => {
  return (
    <div className="w-full h-full bg-slate-900/80 text-white flex items-center justify-center">
      <span className="text-slate-400 text-sm">The Gantry — coming soon</span>
    </div>
  );
});
Gantry.displayName = 'Gantry';
