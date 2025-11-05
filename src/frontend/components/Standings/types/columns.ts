export type ColumnId =
  | 'position'
  | 'carNumber'
  | 'name'
  | 'badge'
  | 'iratingChange'
  | 'delta'
  | 'fastestTime'
  | 'lastTime'
  | 'tireCompound';

export interface ColumnMetadata {
  id: ColumnId;
  displayName: string;
  alwaysVisible: boolean;
}

export const COLUMN_METADATA: Record<ColumnId, ColumnMetadata> = {
  position: { id: 'position', displayName: 'Position', alwaysVisible: true },
  carNumber: { id: 'carNumber', displayName: 'Car Number', alwaysVisible: false },
  name: { id: 'name', displayName: 'Name', alwaysVisible: true },
  badge: { id: 'badge', displayName: 'Badge', alwaysVisible: false },
  iratingChange: { id: 'iratingChange', displayName: 'iRating Change', alwaysVisible: false },
  delta: { id: 'delta', displayName: 'Delta', alwaysVisible: false },
  fastestTime: { id: 'fastestTime', displayName: 'Fastest Time', alwaysVisible: false },
  lastTime: { id: 'lastTime', displayName: 'Last Time', alwaysVisible: false },
  tireCompound: { id: 'tireCompound', displayName: 'Tire Compound', alwaysVisible: false },
};

export const DEFAULT_RELATIVE_COLUMN_ORDER: ColumnId[] = [
  'position',
  'carNumber',
  'name',
  'badge',
  'delta',
  'fastestTime',
  'lastTime',
  'tireCompound',
];

export const DEFAULT_STANDINGS_COLUMN_ORDER: ColumnId[] = [
  'position',
  'carNumber',
  'name',
  'badge',
  'iratingChange',
  'delta',
  'fastestTime',
  'lastTime',
  'tireCompound',
];


