import type { WidgetModule } from '@irdashies/domain';
import {
  AccelerationTimer,
  BrakePressure,
  CruiseOdometer,
  FrictionCircle,
  SteeringMeter,
  StintHistory,
  SuspensionPosition,
  TrackClock,
  TrackNotes,
} from './DrivingMetrics';

const modules = [
  { id: 'tracknotes', component: TrackNotes },
  { id: 'accelerationtimer', component: AccelerationTimer },
  { id: 'stinthistory', component: StintHistory },
  { id: 'frictioncircle', component: FrictionCircle },
  { id: 'brakepressure', component: BrakePressure },
  { id: 'suspensionposition', component: SuspensionPosition },
  { id: 'trackclock', component: TrackClock },
  { id: 'steeringmeter', component: SteeringMeter },
  { id: 'cruiseodometer', component: CruiseOdometer },
] as const satisfies readonly WidgetModule[];

export default modules;
