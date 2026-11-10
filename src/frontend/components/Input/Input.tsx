import { memo } from 'react';
import { InputContainer } from './InputContainer/InputContainer';
import { isInputConfig, useInputSettings } from './hooks/useInputSettings';
import { useGearFlash } from './hooks/useGearFlash';
import { useInputs } from './hooks/useInputs';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';
import { useBlink, useShiftFlashActive } from '@irdashies/domain/shiftLight';
import type { InputWidgetSettings } from '@irdashies/types';

type InputWidgetProps = Partial<InputWidgetSettings['config']>;

/** Pick the effective config and render the widget only while it is visible. */
export const Input = (props: InputWidgetProps) => {
  // Each instance gets its own config as props. Storybook passes none.
  const dashboardSettings = useInputSettings();
  const settings = isInputConfig(props) ? props : dashboardSettings;
  const { isDriving } = useDrivingState();
  const sessionVisible = useSessionVisibility(settings?.sessionVisibility);
  if (
    !settings ||
    !sessionVisible ||
    (settings.showOnlyWhenOnTrack && !isDriving)
  )
    return null;
  return <VisibleInput settings={settings} />;
};

// Mount high-frequency consumers only while content is visible. The parent
// keeps its lightweight track/session subscriptions so it can show us again.
/** Subscribes to driver controls and flash sources; lives only while visible. */
const VisibleInput = memo(
  ({ settings }: { settings: InputWidgetSettings['config'] }) => {
    const inputs = useInputs(settings);
    const shiftFlash = settings?.shiftFlash;
    const flashActive = useShiftFlashActive(
      !!shiftFlash?.enabled,
      shiftFlash?.source ?? 'redline'
    );
    const flashOn = useBlink(flashActive);
    const gearFlash = settings?.gearFlash;
    const gearFlashColor = useGearFlash(
      inputs.gear,
      !!gearFlash?.enabled,
      gearFlash?.upColor ?? '#22c55e',
      gearFlash?.downColor ?? '#ef4444'
    );

    return (
      <div className="h-full flex flex-col">
        <InputContainer
          {...inputs}
          settings={settings}
          flashColor={flashOn ? shiftFlash?.color : undefined}
          gearFlashColor={gearFlashColor}
        />
      </div>
    );
  }
);
VisibleInput.displayName = 'VisibleInput';
