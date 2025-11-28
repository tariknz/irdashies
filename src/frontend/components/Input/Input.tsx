import { InputContainer } from './InputContainer/InputContainer';
import { useInputSettings } from './hooks/useInputSettings';
import { useInputs } from './hooks/useInputs';

export const Input = () => {
  const inputs = useInputs();
  const settings = useInputSettings();

  return <InputContainer {...inputs} settings={settings} />;
};
