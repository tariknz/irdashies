// Messages passed to window.alert / window.confirm.
export default {
  'Invalid JSON format': 'Неверный формат JSON',
  'Invalid JSON — fix errors before exporting':
    'Неверный JSON — исправьте ошибки перед экспортом',
  'Reset all widget configurations to defaults? This will preserve widget positions and enabled states.':
    'Сбросить настройки всех виджетов к значениям по умолчанию? Положение виджетов и их включение сохранятся.',
  'Failed to reset configurations': 'Не удалось сбросить настройки',
  'Reset everything to defaults? This will reset all widget positions, enabled states, and configurations.':
    'Сбросить всё к значениям по умолчанию? Будут сброшены положение, включение и настройки всех виджетов.',
  'Failed to reset dashboard': 'Не удалось сбросить конфигурацию',
  // Fuel Calculator > History
  'Are you sure you want to clear ALL fuel history data? This cannot be undone.':
    'Удалить ВСЮ историю расхода топлива? Это действие нельзя отменить.',
  'Fuel history cleared successfully.': 'История расхода топлива очищена.',
  'Failed to clear fuel history.':
    'Не удалось очистить историю расхода топлива.',
} satisfies Record<string, string>;
