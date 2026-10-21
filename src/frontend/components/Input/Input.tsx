import { InputContainer } from './InputContainer/InputContainer';
import { isInputConfig, useInputSettings } from './hooks/useInputSettings';
import { useGearFlash } from './hooks/useGearFlash';
import { useInputs } from './hooks/useInputs';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';
import { useBlink, useShiftFlashActive } from '@irdashies/domain/shiftLight';
import type { InputWidgetSettings } from '@irdashies/types';

type InputWidgetProps = Partial<InputWidgetSettings['config']>;

export const Input = (props: InputWidgetProps) => {
  // Each instance gets its own config as props. Storybook passes none.
  const dashboardSettings = useInputSettings();
  const settings = isInputConfig(props) ? props : dashboardSettings;
  const inputs = useInputs(settings?.useRawValues ?? false);
  const { isDriving } = useDrivingState();
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

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  if (!settings) return <></>;

  // Show only when on track setting
  if (settings.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

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
};
