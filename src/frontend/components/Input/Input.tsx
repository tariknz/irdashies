import { memo } from 'react';
import { InputContainer } from './InputContainer/InputContainer';
import { isInputConfig, useInputSettings } from './hooks/useInputSettings';
import { useGearFlash } from './hooks/useGearFlash';
import { useInputs } from './hooks/useInputs';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';
import { useBlink, useShiftFlashActive } from '@irdashies/domain/shiftLight';
import type { InputConfig } from '@irdashies/types';

type InputWidgetProps = Partial<InputConfig>;

interface VisibleInputProps {
  settings: InputConfig;
}

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

/** Unmount high-frequency consumers while the parent tracks visibility. */
const VisibleInput = memo(({ settings }: VisibleInputProps) => {
  const inputs = useInputs(settings);
  const { shiftFlash, gearFlash } = settings;
  const flashActive = useShiftFlashActive(
    !!shiftFlash?.enabled,
    shiftFlash?.source ?? 'redline'
  );
  const flashOn = useBlink(flashActive);
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
});
VisibleInput.displayName = 'VisibleInput';
