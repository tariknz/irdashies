import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

const SettingsWindow = lazy(() => import('./windows/SettingsWindow'));
const GantryWindow = lazy(() => import('./windows/GantryWindow'));
const OverlayWindow = lazy(() => import('./windows/OverlayWindow'));
const IndividualWidgetWindow = lazy(
  () => import('./windows/IndividualWidgetWindow')
);
const TapeReplay = lazy(() =>
  import('./components/TapeReplayControls/TapeReplayControls').then(
    (module) => ({ default: module.TapeReplayOverlay })
  )
);

const IbtInspector = lazy(() =>
  import('./components/IbtInspector/IbtInspector').then((module) => ({
    default: module.IbtInspector,
  }))
);

const App = () => {
  const hash = window.location.hash;
  const isInspector = hash.startsWith('#/ibt-inspector');
  const isTape = hash.startsWith('#/tape-replay');
  const isGantry = hash.startsWith('#/gantry');
  const isSettings = hash.startsWith('#/settings');
  const isIndividual = hash === '#/overlay-widget';
  const Content = isInspector
    ? IbtInspector
    : isTape
      ? TapeReplay
      : isGantry
        ? GantryWindow
        : isSettings
          ? SettingsWindow
          : isIndividual
            ? IndividualWidgetWindow
            : OverlayWindow;
  const label = isInspector
    ? 'IBT inspector'
    : isTape
      ? 'tape replay'
      : isGantry
        ? 'gantry'
        : isSettings
          ? 'settings'
          : 'overlay';
  return (
    <ErrorBoundary
      label={label}
      resetAfterMs={isTape || isInspector ? undefined : 2000}
    >
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </ErrorBoundary>
  );
};

const el = document.getElementById('app');
if (!el) throw new Error('No #app element found');
export default App;
createRoot(el).render(<App />);
