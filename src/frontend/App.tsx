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

const App = () => {
  const hash = window.location.hash;
  const isTape = hash.startsWith('#/tape-replay');
  const isGantry = hash.startsWith('#/gantry');
  const isSettings = hash.startsWith('#/settings');
  const isIndividual = hash === '#/overlay-widget';
  const Content = isTape
    ? TapeReplay
    : isGantry
      ? GantryWindow
      : isSettings
        ? SettingsWindow
        : isIndividual
          ? IndividualWidgetWindow
          : OverlayWindow;
  const label = isTape
    ? 'tape replay'
    : isGantry
      ? 'gantry'
      : isSettings
        ? 'settings'
        : 'overlay';
  return (
    <ErrorBoundary label={label} resetAfterMs={isTape ? undefined : 2000}>
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
