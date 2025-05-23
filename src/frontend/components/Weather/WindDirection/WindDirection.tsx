import { useAutoAnimate } from '@formkit/auto-animate/react';
import { WindIcon } from '@phosphor-icons/react';

export interface WindDirectionProps {
  speedMs?: number;
  direction?: number;
}

export const WindDirection = ({ speedMs, direction }: WindDirectionProps) => {
  const speed = speedMs !== undefined ? speedMs * (18 / 5) : undefined;
  const [parent] = useAutoAnimate();
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm">
      <div className="flex flex-row gap-x-2 items-center text-sm mb-3">
        <WindIcon />
        <span className="grow">Wind</span>
      </div>
      <div
        id="wind"
        ref={parent}
        className="flex aspect-square relative w-full max-w-[120px] mx-auto"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 60 60"
          className="absolute stroke-current stroke-[3] w-full h-full box-border fill-none origin-center transform-gpu transition-transform duration-1000 ease-out"
          style={{
            rotate: `calc(${direction ?? 0} * 1rad + 0.5turn)`,
          }}
        >
          <path d="M48 8A28 28 90 0158 30c0 15.464-12.536 28-28 28S2 45.464 2 30A28 28 90 0112 8M22 9 30 1l8 8" />
        </svg>
        <div className="absolute w-full h-full flex justify-center items-center text-[32px]">
          {speed !== undefined ? speed.toFixed(1) : '-'}
        </div>
      </div>
    </div>
  );
};
