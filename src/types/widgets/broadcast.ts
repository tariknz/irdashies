import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcast',
  name: 'Broadcast Tower',
  menuLabel: 'Broadcast',
  // One settings page with a tab per broadcast widget.
  groupTypes: [
    'broadcast',
    'broadcastticker',
    'broadcastevents',
    'broadcastweather',
    'broadcastpodium',
  ],
  enabled: false,
  layout: {
    x: 20,
    y: 20,
    width: 280,
    height: 900,
  },
  config: {
    theme: 'imsa',
    logo: '',
    background: { opacity: 85 },
    translucent: { enabled: false, opacity: 70 },
    driversPerClass: 5,
    title: '',
    pageMode: 'rotate',
    pages: {
      names: true,
      gaps: true,
      gained: true,
      pits: true,
      tyres: true,
    },
    staticPage: 'gaps',
    pageSeconds: 8,
    headerClock: 'session',
    pageTransition: 'random',
    showFocusCard: true,
    phaseScreens: true,
    driverNameFormat: 'surname',
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
