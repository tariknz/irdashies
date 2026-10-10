import { useEffect, useState } from 'react';
import { pickTransition, type Page, type Transition } from '../towerPages';

/** Cycles through the pages like a TV timing tower; one page stays put. */
export const usePageRotation = (
  pages: readonly Page[],
  seconds: number,
  transition: string | undefined
) => {
  const [flip, setFlip] = useState<{ tick: number; effect?: Transition }>({
    tick: 0,
  });
  const rotates = pages.length > 1;
  useEffect(() => {
    if (!rotates) return;
    const id = setInterval(
      () =>
        setFlip((f) => ({
          tick: f.tick + 1,
          effect: pickTransition(transition, f.effect),
        })),
      seconds * 1000
    );
    return () => clearInterval(id);
  }, [rotates, seconds, transition]);
  return { ...flip, page: pages[flip.tick % pages.length] };
};
