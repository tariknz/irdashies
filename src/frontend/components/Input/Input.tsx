import { InputContainer } from './InputContainer/InputContainer';
import { useInputSettings } from './hooks/useInputSettings';
import { useInputs } from './hooks/useInputs';

export const Input = () => {
  const settings = useInputSettings();
  const inputs = useInputs(settings?.useRawValues ?? false);

  if (!settings) return <></>;

  return (
    <div className="h-full flex flex-col">
      <InputContainer {...inputs} settings={settings} />
    </div>
  );
};
