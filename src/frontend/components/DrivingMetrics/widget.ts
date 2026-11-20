import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default [
  {
    id: 'stinthistory',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.StintHistory,
      }))
    ),
  },
  {
    id: 'frictioncircle',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.FrictionCircle,
      }))
    ),
  },
  {
    id: 'brakepressure',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.BrakePressure,
      }))
    ),
  },
  {
    id: 'suspensionposition',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.SuspensionPosition,
      }))
    ),
  },
  {
    id: 'trackclock',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.TrackClock,
      }))
    ),
  },
  {
    id: 'steeringmeter',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.SteeringMeter,
      }))
    ),
  },
  {
    id: 'cruiseodometer',
    component: lazyWidget(() =>
      import('./DrivingMetrics').then((module) => ({
        default: module.CruiseOdometer,
      }))
    ),
  },
] satisfies WidgetModule[];
