import { numberOptions } from './properties';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'fastercarsfrombehind',
  name: 'Faster Cars From Behind',
  menuLabel: 'Faster Cars Behind',
  enabled: false,
  layout: {
    x: 588,
    y: 44,
    width: 405,
    height: 43,
  },
  config: {
    distanceThreshold: -1.5,
    onlyShowFasterClasses: true,
    showOnlyWhenOnTrack: false,
    numberDriversBehind: 3,
    alignDriverBoxes: 'Top',
    closestDriverBox: 'Top',
    showName: true,
    removeNumbersFromName: false,
    showDistance: true,
    showBadge: false,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    showDistance: {
      type: 'boolean',
      label: 'Show Distance',
      description: 'Display the distance to the faster car.',
    },
    showName: {
      type: 'boolean',
      label: 'Show Name',
      description: 'Display the driver name in the faster cars widget.',
    },
    removeNumbersFromName: {
      type: 'boolean',
      label: 'Remove Numbers From Names',
      description: 'Remove numbers from the displayed driver name.',
    },
    showBadge: {
      type: 'boolean',
      label: 'Show Driver Badge',
      description: 'Display the driver license and iRating badge.',
    },
    numberDriversBehind: {
      type: 'enum',
      label: 'Drivers Behind',
      options: numberOptions(1, 10),
      control: 'select',
    },
    alignDriverBoxes: {
      type: 'enum',
      label: 'Align Driver Boxes',
      options: [
        { value: 'Top', label: 'Align to Top of Widget' },
        { value: 'Bottom', label: 'Align to Bottom of Widget' },
      ],
      control: 'select',
    },
    closestDriverBox: {
      type: 'enum',
      label: 'Closest Driver',
      options: [
        { value: 'Top', label: 'Closest Driver at Top' },
        { value: 'Reverse', label: 'Closest Driver at Bottom' },
      ],
      control: 'select',
    },
    onlyShowFasterClasses: {
      type: 'boolean',
      label: 'Only show faster classes',
      description:
        'If enabled, only cars from faster classes will be shown. Same-class competitors will be hidden.',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, faster cars will only be shown when driving',
    },
  },
});
