import { useEffect, useState } from 'react';
import { pickTransition, type Page, type Transition } from '../towerPages';

/** Cycles through the pages like a TV timing tower. */
export const usePageRotation = (
  pages: readonly Page[],
  seconds: number,
  transition: string | undefined
) => {
  const [flip, setFlip] = useState<{ tick: number; effect?: Transition }>({
    tick: 0,
  });
  useEffect(() => {
    const id = setInterval(
      () =>
        setFlip((f) => ({
          tick: f.tick + 1,
          effect: pickTransition(transition, f.effect),
        })),
      seconds * 1000
    );
    return () => clearInterval(id);
  }, [seconds, transition]);
  return { ...flip, page: pages[flip.tick % pages.length] };
};
