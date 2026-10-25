import type { Standings } from '@irdashies/domain';
import { classColor } from './format';

export const ClassTitle = ({ standing }: { standing: Standings }) => (
  <div className="flex items-center gap-2 px-2 pt-1 font-bold italic text-white uppercase">
    <span className={`h-3 w-1 ${classColor(standing.carClass.color)}`} />
    {standing.carClass.name}
  </div>
);
