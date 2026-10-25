import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'garagecover',
  name: 'Garage Cover',
  enabled: false,
  layout: {
    x: 50,
    y: 50,
    width: 600,
    height: 540,
  },
  config: {
    imageFilename: '',
  },
});
