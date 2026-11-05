export default {
  // Widget page frame (BaseSettingsSection) and sim support
  'This will reset the position for both the on-screen overlay and the browser/URL source version.':
    'Положение будет сброшено и для оверлея на экране, и для его версии в браузере (по ссылке).',
  'This widget is not compatible with the running sim':
    'Этот виджет несовместим с запущенным симулятором',
  'Changed: click to reset': 'Изменено: нажмите, чтобы сбросить',
  'Widget Scale': 'Масштаб виджета',
  "Scale this widget's content within its layout.":
    'Масштаб содержимого виджета в пределах его области.',
  'Reset scale to 100%': 'Сбросить масштаб до 100%',
  // Settings loader fallbacks; the first is followed by the widget type id
  'No settings available for': 'Нет настроек для',
  'Select a widget to edit': 'Выберите виджет для настройки',
  // Session bar items list (Standings / Relative header and footer)
  'Hide if single make in session': 'Скрывать, если в сессии одна марка',
  'Hide if only driver of that make':
    'Скрывать, если вы единственный пилот этой марки',
  'Minimal Labels': 'Минимальные подписи',
  'Short Labels': 'Краткие подписи',
  'Hide Labels': 'Без подписей',

  // Pit lane calibration (Pitlane Helper page)
  'Pit Lane Calibration': 'Калибровка пит-лейна',
  'Current track unavailable': 'Текущая трасса недоступна',
  'Checking the current track…': 'Проверка текущей трассы…',
  'Connect to a simulator session to reset calibration for the current track.':
    'Подключитесь к сессии в симуляторе, чтобы сбросить калибровку текущей трассы.',
  'Automatic learning is paused while editing. Save changes, then Reload file to resume learning and enable Reset.':
    'Во время правки автоматическое определение приостановлено. Сохраните изменения, затем нажмите «Перезагрузить файл», чтобы возобновить определение и разблокировать сброс.',
  'No learned calibration for this track. Pit entry and exit are learned as cars use the pit lane.':
    'Для этой трассы калибровки пока нет. Точки въезда на пит-лейн и выезда с него определяются, когда машины проезжают по пит-лейну.',
  'Clear learned pit entry and exit positions for this track. Other tracks are kept.':
    'Удалить определённые точки въезда на пит-лейн и выезда с него для этой трассы. Данные других трасс сохранятся.',
  'Reset calibration': 'Сбросить калибровку',
  'Resetting…': 'Сброс…',
  'Calibration file': 'Файл калибровки',
  'View or edit pitLaneData.json. Positions are lap fractions from 0 to 1, or null. Opening pauses automatic learning. Save changes, then Reload file to apply them and resume learning.':
    'Просмотр и правка файла pitLaneData.json. Позиции задаются долей круга от 0 до 1 или null. Открытие файла приостанавливает автоматическое определение. Сохраните изменения, затем нажмите «Перезагрузить файл», чтобы применить их и возобновить определение.',
  'Open calibration file': 'Открыть файл калибровки',
  'Opening…': 'Открытие…',
  'Reload file': 'Перезагрузить файл',
  'Reloading…': 'Перезагрузка…',
  'Reset pit lane calibration?': 'Сбросить калибровку пит-лейна?',
  'Could not read the current track. Try again when the simulator is connected.':
    'Не удалось определить текущую трассу. Повторите попытку, когда симулятор будет подключён.',
  'Calibration was reset, but the current track status could not be refreshed.':
    'Калибровка сброшена, но не удалось обновить состояние текущей трассы.',
  'Could not reset calibration. Check that the same track is still connected, then try again.':
    'Не удалось сбросить калибровку. Убедитесь, что подключена та же трасса, и повторите попытку.',
  'Calibration file reloaded. Saved edits are now applied to the overlays.':
    'Файл калибровки перезагружен. Сохранённые правки применены к оверлеям.',
  'Calibration was reloaded, but the current track status could not be refreshed.':
    'Калибровка перезагружена, но не удалось обновить состояние текущей трассы.',
  'Opened pitLaneData.json. Save your changes, then choose Reload file. Automatic learning stays paused until a valid reload.':
    'Файл pitLaneData.json открыт. Сохраните изменения, затем нажмите «Перезагрузить файл». Автоматическое определение останется приостановленным до успешной перезагрузки.',
  'Could not open the calibration file. Check your default application for JSON files, then try again.':
    'Не удалось открыть файл калибровки. Проверьте, какое приложение по умолчанию открывает файлы JSON, и повторите попытку.',
  'Could not reload the calibration file. Check the JSON, track IDs, and pitEntryPct/pitExitPct values (0 to 1 or null), then try again.':
    'Не удалось перезагрузить файл калибровки. Проверьте JSON, ID трасс и значения pitEntryPct/pitExitPct (от 0 до 1 или null) и повторите попытку.',

  // Icon picker (Driver Tags)
  'Select an Icon': 'Выберите значок',
  'Search icons...': 'Поиск значков…',
  'Clear selection': 'Сбросить выбор',

  // Storage status notice
  'Disk full — data cannot be saved': 'Диск заполнен — данные не сохраняются',
  'Fuel history or reference laps cannot be saved. Free disk space to resume saving.':
    'Не удаётся сохранить историю расхода топлива и эталонные круги. Освободите место на диске, чтобы возобновить сохранение.',

  // Release notes (interface only; the notes themselves stay as published)
  'Release notes preview': 'Предпросмотр списка изменений',
  'Close release notes': 'Закрыть список изменений',
  'Open image': 'Открыть изображение',
  'Open video': 'Открыть видео',
  'Open attachment': 'Открыть вложение',
  'Media could not be loaded. Open it on GitHub to view it.':
    'Не удалось загрузить медиафайл. Откройте его на GitHub.',
  'Release screenshot': 'Скриншот выпуска',
  'Release video': 'Видео выпуска',
  'Your browser cannot play this video.':
    'Браузер не может воспроизвести это видео.',
  // Followed by the release date
  Released: 'Дата выпуска:',
  'View on GitHub': 'Открыть на GitHub',
  'Loading release notes…': 'Загрузка списка изменений…',
  'Release notes have not been published for this version.':
    'Список изменений для этой версии ещё не опубликован.',
  'Could not load release notes. Check your connection and try again.':
    'Не удалось загрузить список изменений. Проверьте подключение и повторите попытку.',
  'No release notes were included for this version.':
    'Для этой версии нет списка изменений.',
  'Could not load or save release notes preferences.':
    'Не удалось загрузить или сохранить настройки списка изменений.',
  'Show release notes after updates':
    'Показывать список изменений после обновления',
  'Local upgrade simulation. Release note preferences and dismissal are saved separately.':
    'Локальная имитация обновления. Настройки списка изменений и отметка о прочтении сохраняются отдельно.',
  'Installed:': 'Установлена:',
  'Downloaded update:': 'Загруженное обновление:',
  'Preview update dialog': 'Предпросмотр окна обновления',
  'Development only. Uses sample notes and does not change dismissal state.':
    'Только для разработки. Показывает пример списка изменений и не меняет отметку о прочтении.',

  // General
  'Configure general application settings and preferences.':
    'Общие настройки приложения.',
  Font: 'Шрифт',
  'Font Weight': 'Начертание шрифта',
  Normal: 'Обычный',
  Medium: 'Средний',
  Semibold: 'Полужирный',
  Bold: 'Жирный',
  Extrabold: 'Сверхжирный',
  Tiny: 'Крошечный',
  '3x Small': 'Мелкий ×3',
  '2x Small': 'Мелкий ×2',
  'Extra Small': 'Очень мелкий',
  Small: 'Мелкий',
  Large: 'Крупный',
  'Extra Large': 'Очень крупный',
  '2X Large': 'Крупный ×2',
  '3X Large': 'Крупный ×3',
  '4X Large': 'Крупный ×4',
  '5X Large': 'Крупный ×5',
  '6X Large': 'Крупный ×6',
  '7X Large': 'Крупный ×7',
  '8X Large': 'Крупный ×8',
  '9X Large': 'Крупный ×9',
  'Compact Mode': 'Компактный режим',
  Ultra: 'Ультра',
  'Edit Mode': 'Режим редактирования',
  'Controls for positioning and sizing widgets while editing the overlay layout.':
    'Настройки перемещения и изменения размера виджетов при редактировании раскладки оверлеев.',
  'Show Pixel Distances': 'Показывать расстояния в пикселях',
  'Shows the pixel distance from widgets to each edge of the viewport.':
    'Показывает расстояние в пикселях от виджетов до каждого края экрана.',
  'Snap Widgets to Grid': 'Привязывать виджеты к сетке',
  "Snaps widget movement and resizing to the pixel grid. Hold 'Shift' while dragging or resizing to temporarily disable snapping.":
    'Перемещение и изменение размера виджетов привязываются к пиксельной сетке. Удерживайте Shift при перетаскивании или изменении размера, чтобы временно отключить привязку.',
  'Color Theme': 'Цветовая тема',
  'Slate (default)': 'Slate (по умолчанию)',
  'More settings are available in the desktop app, including taskbar visibility, startup options, and hardware acceleration.':
    'Остальные настройки — видимость на панели задач, параметры запуска и аппаратное ускорение — доступны в настольном приложении.',
  'Individual Overlay Windows': 'Отдельные окна оверлеев',
  'Give each widget its own window, allowing it to span monitors. Applies immediately. Edit Layout temporarily uses shared screen windows and restarts local chart history and any in-progress Lap Trace recording.':
    'Каждый виджет получает собственное окно и может располагаться на нескольких мониторах. Применяется сразу. При редактировании раскладки временно используются общие окна экранов, а локальная история графиков и текущая запись телеметрии круга начинаются заново.',
  'Warning: increases CPU usage compared with shared display windows.':
    'Внимание: нагрузка на процессор выше, чем с общими окнами экранов.',
  'Hide Overlays from Taskbar': 'Скрывать оверлеи с панели задач',
  "When enabled, overlay windows won't appear in the taskbar. The app is still accessible via the system tray. (requires restart)":
    'Если включено, окна оверлеев не показываются на панели задач. Приложение остаётся доступным через системный трей. (нужен перезапуск)',
  'Keep Overlays Always On Top': 'Оверлеи поверх всех окон',
  'When enabled, overlay windows will always stay on top of other applications. (requires restart)':
    'Если включено, окна оверлеев всегда остаются поверх других приложений. (нужен перезапуск)',
  'Enable Web Server': 'Включить веб-сервер',
  'Runs the built-in web server that exposes your overlays as browser sources for OBS. When disabled, the app listens on no ports at all — freeing port 3000 — and the OBS browser source URLs stop working. Leave enabled if you stream or record. (requires restart)':
    'Запускает встроенный веб-сервер, который делает оверлеи доступными как браузерные источники для OBS. Если выключено, приложение не занимает ни одного порта (порт 3000 освобождается), а ссылки браузерных источников OBS перестают работать. Оставьте включённым, если ведёте трансляции или записываете видео. (нужен перезапуск)',
  'Enable Network Access': 'Разрешить доступ по сети',
  'When enabled, the component server binds to all network interfaces (0.0.0.0), allowing other devices on your network to access the dashboard. When disabled, only localhost connections are allowed. (requires restart)':
    'Если включено, сервер компонентов слушает все сетевые интерфейсы (0.0.0.0), и другие устройства в вашей сети могут открывать оверлеи. Если выключено, разрешены только подключения с localhost. (нужен перезапуск)',
  'Hardware Acceleration': 'Аппаратное ускорение',
  'Uses GPU hardware acceleration for rendering. Only disable this if you are experiencing compatibility issues, as it will significantly impact performance. (requires restart)':
    'Использует аппаратное ускорение GPU для отрисовки. Отключайте его только при проблемах совместимости: производительность заметно снизится. (нужен перезапуск)',
  'Start on system startup': 'Запускать вместе с системой',
  'If enabled, irDashies will start automatically on system start up.':
    'Если включено, irDashies запускается автоматически при старте системы.',
  'Start minimized': 'Запускать свёрнутым',
  'If enabled, the main settings window will start minimized to the system tray.':
    'Если включено, главное окно настроек при запуске сворачивается в системный трей.',
  'Close to tray': 'Сворачивать в трей при закрытии',
  'If enabled, closing the app will minimise to the system tray rather than quitting.':
    'Если включено, при закрытии приложение сворачивается в системный трей, а не завершает работу.',
  Simulator: 'Симулятор',
  'Which simulator to read telemetry from. Auto picks whichever supported simulator is running.':
    'Из какого симулятора читать телеметрию. «Авто» выбирает тот поддерживаемый симулятор, который запущен.',
  // Simulator option suffix
  '(not available in this build)': '(недоступно в этой сборке)',

  // Profiles
  'Configuration Profiles': 'Профили настроек',
  'Manage different dashboard configurations for various scenarios. Each profile stores separate widget configurations and layouts.':
    'Управляйте разными конфигурациями для разных сценариев. Каждый профиль хранит собственные настройки и раскладку виджетов.',
  'Create New Profile': 'Новый профиль',
  'Enter profile name...': 'Название профиля…',
  'Creating...': 'Создание…',
  'Your Profiles': 'Ваши профили',
  'Browser and OBS widget positions are saved separately from the desktop layout. Use Actions > Edit Browser Layout to drag and resize widgets for OBS, then copy the same profile URL into your browser source.':
    'Положение виджетов для браузера и OBS хранится отдельно от раскладки на рабочем столе. Выберите «Действия» > «Редактировать раскладку для браузера», чтобы перемещать виджеты и менять их размер для OBS, затем скопируйте ссылку этого профиля в браузерный источник.',
  'No profiles found. Create your first profile above.':
    'Профили не найдены. Создайте первый профиль выше.',
  'Active Profile': 'Активный профиль',
  // Followed by the date
  'Modified:': 'Изменён:',
  Switch: 'Переключиться',
  'Copy browser URL for this profile':
    'Скопировать ссылку этого профиля для браузера',
  'Copy URL': 'Скопировать ссылку',
  Actions: 'Действия',
  'Open this profile in your browser to arrange its OBS widgets':
    'Открыть профиль в браузере, чтобы расставить виджеты для OBS',
  'Edit Browser Layout': 'Редактировать раскладку для браузера',
  Clone: 'Дублировать',
  'Cycle Profiles': 'Переключать профили по кругу',
  'When switching profiles with the keyboard shortcut, wrap around from the last profile back to the first (and vice versa).':
    'При переключении профилей горячими клавишами переходить от последнего профиля к первому (и наоборот).',
  'Show Profile Name Banner': 'Показывать название профиля',
  'Briefly display the profile name on the overlay when switching profiles.':
    'При переключении профиля ненадолго показывать его название поверх оверлеев.',
  'Switch Profile By Session': 'Профиль по типу сессии',
  "Set a profile for each session type and it is applied automatically as the event moves from practice through to the race. A session left on Don't switch keeps whatever profile you are already on, so to come back to a layout, map that session to it rather than leaving it unset.":
    'Задайте профиль для каждого типа сессии, и он будет применяться автоматически по ходу события — от практики до гонки. Сессия с вариантом «Не переключать» оставляет текущий профиль, поэтому, чтобы вернуться к раскладке, назначьте её этой сессии, а не оставляйте выбор пустым.',
  "Don't switch": 'Не переключать',
  'Spotting / watching': 'Наблюдение вне машины',
  // "Use <profile name> for all sessions", split around the name
  Use: 'Использовать',
  'current profile': 'текущий профиль',
  'for all sessions': 'для всех сессий',
  'Applied while you are in a session but not in the car, whichever session type it is, and handed back as soon as you are driving again.':
    'Применяется, пока вы в сессии, но не в машине, при любом типе сессии, и снимается, как только вы снова садитесь за руль.',
  'OBS Browser Source': 'Браузерный источник OBS',
  'The built-in web server is turned off, so browser source URLs are unavailable. Re-enable it under Settings → General → Enable Web Server (requires restart).':
    'Встроенный веб-сервер выключен, поэтому ссылки для браузерных источников недоступны. Включите его: «Настройки» → «Общие» → «Включить веб-сервер» (нужен перезапуск).',
  'Loading browser source URLs...':
    'Загрузка ссылок для браузерных источников…',
  'Could not load browser source URLs. Close and reopen Profiles to try again.':
    'Не удалось загрузить ссылки для браузерных источников. Закройте и снова откройте раздел «Профили».',
  'Use the URL below for OBS browser sources. OBS requires IP addresses instead of localhost.':
    'Используйте ссылку ниже для браузерных источников OBS. OBS требует IP-адрес вместо localhost.',
  'Localhost (Development)': 'Localhost (разработка)',
  'IP Address (OBS/Streaming)': 'IP-адрес (OBS и трансляции)',
  'Copy for OBS': 'Копировать для OBS',
  // "Note: ... IP address (<ip>). Works in ...", split around the address
  "Note: This URL uses your server's IP address (":
    'Примечание: эта ссылка использует IP-адрес вашего сервера (',
  '). Works in OBS browser sources and from other machines.':
    '). Работает в браузерных источниках OBS и на других компьютерах.',
  'About Profiles': 'О профилях',
  'Each profile has its own widget configurations and layouts':
    'У каждого профиля свои настройки и раскладка виджетов',
  'Switch between profiles to use different dashboard setups':
    'Переключайтесь между профилями, чтобы использовать разные наборы оверлеев',
  'The Default cannot be deleted': 'Стандартный профиль нельзя удалить',
  'Profile changes are automatically saved':
    'Изменения профилей сохраняются автоматически',
  'Delete Profile': 'Удалить профиль',
  'Keep Profile': 'Оставить профиль',
  'Profile name cannot be empty': 'Название профиля не может быть пустым',
  'Cannot delete the Default profile': 'Стандартный профиль нельзя удалить',
  'Failed to create profile': 'Не удалось создать профиль',
  'Failed to delete profile': 'Не удалось удалить профиль',
  'Failed to clone profile': 'Не удалось дублировать профиль',
  'Failed to rename profile': 'Не удалось переименовать профиль',
  'Failed to switch profile': 'Не удалось переключить профиль',

  // Key Bindings
  'Customize keyboard shortcuts. Click a binding then press a new key combination, or hold two or more controller buttons together for a combo.':
    'Настройте горячие клавиши. Нажмите на привязку, затем нажмите новое сочетание клавиш или одновременно удерживайте две и более кнопки контроллера, чтобы задать комбинацию.',
  'Reset All': 'Сбросить все',
  'Reset to default': 'Вернуть по умолчанию',
  'Failed to set keybinding': 'Не удалось назначить сочетание',
  // Text of the (font-mono) shortcut recorder button
  'Press keys...': 'Нажмите клавиши…',
  'Not set': 'Не задано',
  'Widget Visibility': 'Видимость виджетов',
  'Assign a key or controller button to show / hide an individual widget. Unbound by default.':
    'Назначьте клавишу или кнопку контроллера, чтобы показывать и скрывать отдельный виджет. По умолчанию не назначено.',
  // Default bindings (src/types/keybindings.ts)
  'Hide / Show UI': 'Скрыть / показать интерфейс',
  'Toggle visibility of all overlay windows':
    'Переключить видимость всех окон оверлеев',
  'Lock or unlock overlays for repositioning':
    'Заблокировать или разблокировать оверлеи для перемещения',
  'Save Telemetry': 'Сохранить телеметрию',
  'Capture current telemetry data and screenshots':
    'Сохранить текущие данные телеметрии и скриншоты',
  'Previous Profile': 'Предыдущий профиль',
  'Switch to the previous configuration profile':
    'Переключиться на предыдущий профиль настроек',
  'Next Profile': 'Следующий профиль',
  'Switch to the next configuration profile':
    'Переключиться на следующий профиль настроек',
  'Radar: Flip Pole Side': 'Радар: сменить сторону поула',
  'Swap the pole line side on the radar for the current track and remember it':
    'Поменять сторону поула на радаре для текущей трассы и запомнить её',

  // Driver Tags
  'Create color-coded or icon driver tag groups and assign drivers by iRacing ID (preferred) or iRacing Name.':
    'Создавайте группы меток с цветом или значком и назначайте пилотов по iRacing ID (предпочтительно) или по имени в iRacing.',
  'Display Style': 'Стиль отображения',
  'Badges (icons, filled)': 'Значки (с заливкой)',
  'Badges (icons, outlined)': 'Значки (контурные)',
  'Tags (colored pills)': 'Метки (цветные плашки)',
  'Default Groups': 'Стандартные группы',
  // Preset group names (src/frontend/constants/driverTagBadges.ts)
  Dangerous: 'Опасный',
  Friend: 'Друг',
  'Custom Groups': 'Свои группы',
  'Add Group': 'Добавить группу',
  'Group Name': 'Название группы',
  'Custom Image': 'Своё изображение',
  'Select an Image': 'Выбрать изображение',
  preview: 'превью',
  'Driver Assignments': 'Назначение пилотов',
  'Assign drivers by iRacing ID (preferred) and/or display name. Each driver may belong to one group.':
    'Назначайте пилотов по iRacing ID (предпочтительно) и/или отображаемому имени. Каждый пилот может входить только в одну группу.',
  'iRacing Name': 'Имя в iRacing',
  'Driver Label': 'Подпись пилота',
  'Search for a Driver ...': 'Поиск пилота…',
  'Close search': 'Закрыть поиск',
  'Search drivers': 'Искать пилотов',
  'e.g. 123456': 'например, 123456',
  'iRacing Full Name': 'Полное имя в iRacing',
  'Badge label': 'Подпись значка',
  'Driver already exists': 'Этот пилот уже добавлен',
  'Add Driver': 'Добавить пилота',
  '* iRacing ID is matched first when provided. Display name is used as a fallback if no ID is set or no match is found.':
    '* Сначала сверяется iRacing ID, если он указан. Отображаемое имя используется, если ID не задан или совпадение не найдено.',
  'Name Display': 'Отображение имени',
  'When a Driver Label is provided, choose what is displayed for the Driver Name in the Standings and Relative overlays.':
    'Если задана подпись пилота, выберите, что показывать вместо имени пилота в оверлеях «Таблица позиций» и «Относительная таблица».',
  'Display mode': 'Режим отображения',
  'Both (Alternate)': 'Оба (поочерёдно)',
  'Label only': 'Только подпись',
  'Name only': 'Только имя',
  'Alternate Frequency': 'Интервал смены',

  // Setup Comparison
  'Car Setup': 'Сетап машины',
  'Current car setup configuration from iRacing':
    'Текущий сетап машины из iRacing',
  'Car setup data is not available.': 'Данные сетапа недоступны.',
  'Join a session and get in the car to view setup information.':
    'Зайдите в сессию и сядьте в машину, чтобы увидеть сетап.',
  'Take Snapshot': 'Сделать снимок',
  'Clear All': 'Очистить всё',
  'Compare:': 'Сравнение:',
  'To First': 'С первым',
  'To Previous': 'С предыдущим',
  'Comparing all columns to the first (leftmost) snapshot - differences in red':
    'Все столбцы сравниваются с первым (крайним левым) снимком — различия выделены красным',
  'Comparing each column to the one directly to its left - differences in red':
    'Каждый столбец сравнивается с соседним слева — различия выделены красным',
  'Click "Take Snapshot" to capture the current setup.':
    'Нажмите «Сделать снимок», чтобы сохранить текущий сетап.',
  'Tires & Aero': 'Шины и аэродинамика',
  Tires: 'Шины',
  Chassis: 'Шасси',
  Suspension: 'Подвеска',
  'Drive & Brake': 'Привод и тормоза',
  Drivetrain: 'Трансмиссия',
  Dampers: 'Амортизаторы',
  Systems: 'Системы',

  // Layout editor (Input and Fuel pages)
  'Invalid Node': 'Неверный узел',
  Box: 'Блок',
  Empty: 'Пусто',
  'ADD TO GROUP': 'ДОБАВИТЬ В ГРУППУ',
  'Drag items to split. Drop in CENTER to join group.':
    'Перетаскивайте элементы, чтобы разделить блок. Отпустите в ЦЕНТРЕ, чтобы объединить в группу.',
  'Available Widgets': 'Доступные виджеты',
  'All widgets used': 'Все виджеты использованы',
  'Drop to Remove': 'Отпустите, чтобы удалить',

  // About
  'iRacing Dashies is an open-source iRacing Dashboards & Overlays application that helps you customize and enhance your racing experience.':
    'iRacing Dashies — приложение с открытым исходным кодом с приборными панелями и оверлеями для iRacing, которое помогает настроить и улучшить ваш гоночный опыт.',
  Connect: 'Связь',
  'GitHub Repository': 'Репозиторий на GitHub',
  'Join our Discord Community': 'Присоединяйтесь к нашему сообществу в Discord',
  'Privacy Policy': 'Политика конфиденциальности',
  'Last updated October 2026': 'Последнее обновление: октябрь 2026',
  'irDashies collects limited, anonymous usage data to help us improve the application, identify issues, and prioritise future development.':
    'irDashies собирает ограниченный объём анонимных данных об использовании, чтобы улучшать приложение, находить проблемы и определять приоритеты дальнейшей разработки.',
  'Data We Collect': 'Какие данные мы собираем',
  'We collect the following anonymous data:':
    'Мы собираем следующие анонимные данные:',
  'Settings data': 'Данные настроек',
  'Used to understand which widgets are enabled and how they are configured. This helps improve defaults, testing coverage, and informs feature deprecation decisions.':
    'Показывают, какие виджеты включены и как они настроены. Это помогает улучшать настройки по умолчанию и покрытие тестами, а также принимать решения об отказе от функций.',
  'Pit-lane calibration': 'Калибровка пит-лейна',
  'Track IDs and learned pit entry and exit positions are sent at startup when calibration changes to help improve pit-lane detection.':
    'ID трасс и определённые точки въезда на пит-лейн и выезда с него отправляются при запуске, если калибровка изменилась, чтобы улучшить распознавание пит-лейна.',
  'Radar pole-side corrections': 'Исправления стороны поула на радаре',
  'Track IDs and the pole side you chose for a race start, a restart or a standing grid with the radar key, together with the side the built-in table gave, are sent shortly after your corrections change (or at the next startup), to improve the table for everyone.':
    'ID трасс и сторона поула, которую вы выбрали клавишей радара для старта гонки, рестарта или старта с места, вместе со стороной из встроенной таблицы отправляются вскоре после изменения ваших исправлений (или при следующем запуске), чтобы улучшить таблицу для всех.',
  'System information': 'Сведения о системе',
  'Including operating system, CPU, memory, and screen resolution. This data helps us optimise performance and ensure compatibility across common hardware configurations.':
    'В том числе операционная система, процессор, память и разрешение экрана. Эти данные помогают оптимизировать производительность и обеспечивать совместимость с распространёнными конфигурациями оборудования.',
  'Errors and crashes': 'Ошибки и сбои',
  'Exception and failure data is collected to diagnose issues, improve stability, and prioritise fixes.':
    'Данные об исключениях и сбоях собираются, чтобы диагностировать проблемы, повышать стабильность и определять приоритеты исправлений.',
  'General usage data and approximate location':
    'Общие данные об использовании и приблизительное местоположение',
  'Used to understand active user counts, retention trends, and regional usage to guide localisation and roadmap decisions. Location is approximated using IP-based geolocation at a city level. IP addresses are not stored, and only approximate location data (such as city and country) is retained.':
    'Показывают число активных пользователей, их удержание и распределение по регионам, чтобы принимать решения о локализации и планах развития. Местоположение определяется приблизительно, по IP-адресу, с точностью до города. IP-адреса не сохраняются — хранятся только приблизительные данные о местоположении (например, город и страна).',
  'How Data Is Collected': 'Как собираются данные',
  'Product analytics are collected using PostHog with privacy-focused settings:':
    'Аналитика собирается с помощью PostHog с настройками, ориентированными на конфиденциальность:',
  'IP address storage is disabled': 'Хранение IP-адресов отключено',
  'Session recording is disabled': 'Запись сеансов отключена',
  'Autocapture is disabled': 'Автоматический сбор событий отключён',
  'Important Privacy Information': 'Важная информация о конфиденциальности',
  'No personally identifiable information (PII) is collected':
    'Персональные данные (PII) не собираются',
  'All analytics data is anonymised': 'Все данные аналитики обезличены',
  'Data is not sold or shared with third parties beyond analytics processing':
    'Данные не продаются и не передаются третьим лицам, кроме как для обработки аналитики',
  'Analytics data is hosted within the European Union':
    'Данные аналитики хранятся в Европейском союзе',
  'Legal Basis': 'Правовое основание',
  'Analytics data is processed under our legitimate interest in maintaining, improving, and securing the application.':
    'Данные аналитики обрабатываются на основании нашего законного интереса в поддержке, улучшении и защите приложения.',
  'Data Retention': 'Срок хранения данных',
  'Analytics event data is retained for up to 1 year, after which it is automatically deleted.':
    'Данные о событиях аналитики хранятся до 1 года, после чего автоматически удаляются.',
  'Your Choices': 'Ваш выбор',
  'You may disable analytics collection at any time by opting out below.':
    'Вы можете в любой момент отключить сбор аналитики с помощью настройки ниже.',
  Contact: 'Контакты',
  'If you have any questions about this policy or data collection, you can contact us via our GitHub repository by creating an issue:':
    'Если у вас есть вопросы об этой политике или о сборе данных, свяжитесь с нами через репозиторий на GitHub, создав issue:',
  'Enable analytics data collection': 'Разрешить сбор данных аналитики',
  'Help improve the application by sharing anonymous usage data. You can opt out at any time by unchecking this box.':
    'Помогите улучшить приложение, делясь анонимными данными об использовании. Вы можете отказаться в любой момент, сняв этот флажок.',
  'Note: Please restart the application for this setting to take effect.':
    'Примечание: чтобы настройка вступила в силу, перезапустите приложение.',

  // Advanced
  'Configure advanced system settings and preferences.':
    'Расширенные системные настройки.',
  // Tab with the dashboard.json editor
  Dashboard: 'Конфигурация',
  'Directly edit the dashboard configuration file and apply changes':
    'Прямое редактирование файла конфигурации с применением изменений',
  Import: 'Импорт',
  Export: 'Экспорт',
  'Dashboard configuration JSON...': 'JSON конфигурации…',
  Logs: 'Журналы',
  'Open log folder': 'Открыть папку журналов',
  'Export log file': 'Экспортировать журнал',
  'Widget configs only': 'Только настройки виджетов',
  'Everything to factory defaults': 'Всё к заводским настройкам',
  'Debug widget to display raw telemetry and session values':
    'Отладочный виджет для просмотра необработанных значений телеметрии и сессии',

  // Advanced > Chromium
  'Default (Chromium chooses)': 'По умолчанию (выбирает Chromium)',
  'Override Chromium command-line switches. Use these only if you experience rendering glitches like black flickering on transparent overlays. These settings are stored locally per machine (separate from dashboard.json) and require an app restart to take effect.':
    'Переопределение ключей командной строки Chromium. Используйте их, только если видите ошибки отрисовки, например чёрное мерцание прозрачных оверлеев. Эти настройки хранятся локально на каждом компьютере (отдельно от dashboard.json) и вступают в силу после перезапуска приложения.',
  'Recommended fixes': 'Рекомендуемые исправления',
  'Disable native window occlusion':
    'Отключить нативное отслеживание перекрытия окон',
  'Prevents Chromium from blanking the overlay when it incorrectly thinks the window is hidden. Most common fix for black flickering on NVIDIA GPUs (sets --disable-features=CalculateNativeWinOcclusion).':
    'Не даёт Chromium очищать оверлей, когда он ошибочно считает окно скрытым. Самое распространённое исправление чёрного мерцания на видеокартах NVIDIA (задаёт --disable-features=CalculateNativeWinOcclusion).',
  'ANGLE graphics backend': 'Графический бэкенд ANGLE',
  "Forces Chromium's graphics backend. Switching to OpenGL often resolves NVIDIA RTX-series transparency bugs at a small performance cost (sets --use-angle).":
    'Принудительно задаёт графический бэкенд Chromium. Переход на OpenGL часто устраняет ошибки прозрачности на видеокартах NVIDIA серии RTX ценой небольшой потери производительности (задаёт --use-angle).',
  'Disable Direct Composition': 'Отключить DirectComposition',
  'Disables Windows DirectComposition for transparent windows. Heavier fallback than the occlusion fix while still keeping GPU rendering enabled (sets --disable-direct-composition).':
    'Отключает DirectComposition в Windows для прозрачных окон. Более радикальный запасной вариант, чем исправление перекрытия, при котором отрисовка на GPU остаётся включённой (задаёт --disable-direct-composition).',
  'Additional features': 'Дополнительные функции',
  'Disable features': 'Отключить функции',
  'Enable features': 'Включить функции',
  // Followed by <code>--disable-features</code> or <code>--enable-features</code>
  'Comma- or space-separated feature names appended to':
    'Названия функций через запятую или пробел; добавляются к',
  'e.g. HardwareMediaKeyHandling, WidgetLayering':
    'например, HardwareMediaKeyHandling, WidgetLayering',
  'e.g. CanvasOopRasterization': 'например, CanvasOopRasterization',
  'Custom switches': 'Собственные ключи',
  // "Format: <code>switch-name</code> or <code>switch-name=value</code> (no
  // leading <code>--</code>). Lines starting with <code>#</code> are ignored."
  'Freeform Chromium switches, one per line. Format:':
    'Произвольные ключи Chromium, по одному в строке. Формат:',
  '(no leading': '(без',
  '). Lines starting with': '). Строки с символом',
  'are ignored.': 'в начале игнорируются.',
  '# One switch per line, no leading "--" # Examples: # disable-gpu-vsync # force-color-profile=srgb':
    '# Один ключ в строке, без "--" в начале\n# Примеры:\n# disable-gpu-vsync\n# force-color-profile=srgb',
  'Reset all Chromium flags': 'Сбросить все флаги Chromium',

  // Battle
  'Gap / Prev / Delta': 'Отставание / от предыдущего / дельта',
  'Shows the cars immediately ahead and behind the player with gap information':
    'Показывает машины непосредственно впереди и позади вас и отставание до них',

  // Blind Spot Monitor
  'Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side.':
    'Настройки контроля слепых зон: виджет показывает индикаторы, когда слева или справа от вас есть машина.',
  'Indicator Color': 'Цвет индикатора',
  'Square Colour': 'Цвет квадрата',
  '1 car colour': 'Цвет при 1 машине',
  '2+ cars colour': 'Цвет при 2+ машинах',

  // Broadcast (module rail, shared transition, preview)
  Tower: 'Таблица',
  Ticker: 'Бегущая строка',
  Events: 'События',
  Podium: 'Подиум',
  Random: 'Случайный',
  'Slide Left': 'Сдвиг влево',
  'Slide Right': 'Сдвиг вправо',
  'Slide Up': 'Сдвиг вверх',
  Fade: 'Растворение',
  Flip: 'Переворот',
  Wipe: 'Шторка',
  Zoom: 'Приближение',
  Checker: 'Шахматка',
  'All modules': 'Все модули',
  'Reset transition': 'Сбросить переход',
  Transition: 'Переход',
  'How every module animates: tower page changes, ticker views, and events, weather and podium cards popping up. Random never uses the same one twice in a row.':
    'Анимация всех модулей: смена страниц таблицы и видов бегущей строки, появление карточек событий, погоды и подиума. «Случайный» не повторяет один и тот же переход дважды подряд.',
  // Followed by the module's OBS URL
  'Add each module to OBS as its own Browser Source, so each gets its own size and place on the stream:':
    'Добавьте каждый модуль в OBS отдельным браузерным источником, чтобы у каждого были свой размер и место на трансляции:',
  'Broadcast modules': 'Модули трансляции',
  Modules: 'Модули',
  'Every event kind is off.': 'Все типы событий выключены.',

  // Broadcast Tower
  'TV-style timing tower that cycles between names, per-class intervals with close battles, positions gained, pit laps and tyres, plus a card for the car on camera.':
    'Таблица хронометража в стиле ТВ: поочерёдно показывает имена, интервалы по классам с плотной борьбой, отыгранные позиции, круги пит-стопов и шины, а также карточку машины в кадре.',
  'Session + Track Time': 'Сессия + время на трассе',
  'Session + Local Time': 'Сессия + местное время',
  'Laps + Time': 'Круги + время',
  Rotate: 'Чередовать',
  Static: 'Одна страница',
  'Positions and drivers.': 'Позиции и пилоты.',
  Intervals: 'Интервалы',
  'One page per class, with the closest battle under it.':
    'По странице на класс, под ней — самая плотная борьба.',
  '+/- Start': '+/- со старта',
  'Places gained since the start. Races only.':
    'Позиции, отыгранные со старта. Только в гонках.',
  'Last Pit': 'Последний пит-стоп',
  'Lap of the last stop, once someone has pitted.':
    'Круг последнего пит-стопа — после того как кто-нибудь заедет на пит-лейн.',
  Tyres: 'Шины',
  'Current compound, when the car has a choice.':
    'Текущий состав шин, если у машины есть выбор.',
  'Series Logo': 'Логотип серии',
  'Shown above the tower title. PNG with transparency works best, up to 300 KB.':
    'Показывается над заголовком таблицы. Лучше всего подходит PNG с прозрачностью, до 300 КБ.',
  'Pick an image file.': 'Выберите файл изображения.',
  'That image is over 300 KB.': 'Изображение больше 300 КБ.',
  'Pick a supported image file.':
    'Выберите изображение в поддерживаемом формате.',
  Translucent: 'Полупрозрачность',
  'Fade the whole widget, text included, so it hides less of the stream.':
    'Делает полупрозрачным весь виджет вместе с текстом, чтобы он меньше закрывал трансляцию.',
  'Drivers Per Class': 'Пилотов в классе',
  'Header Clock': 'Часы в заголовке',
  'The session clock, plus the time of day at the track or on this PC, or laps and time together.':
    'Время сессии плюс время суток на трассе или на этом компьютере либо круги вместе со временем.',
  Pages: 'Страницы',
  'Rotate through the pages you pick, or keep one page up.':
    'Чередовать выбранные страницы или показывать одну.',
  Page: 'Страница',
  'Intervals here show every class at once.':
    'Здесь интервалы показывают все классы сразу.',
  'Page Time': 'Время страницы',
  'Track name': 'Название трассы',
  'Focus Car Card': 'Карточка машины в кадре',
  'Show name, team and lap times of the car the camera is on.':
    'Показывать имя, команду и время кругов машины, которую показывает камера.',
  'Starting Grid': 'Стартовая решётка',
  'Show the starting grid under the tower before the race starts. The podium is its own module.':
    'Показывать стартовую решётку под таблицей до старта гонки. Подиум — отдельный модуль.',

  // Broadcast Ticker
  'Scrolling bottom-of-screen ticker. After each full loop it moves on: standings, fastest laps, then the best car of each manufacturer.':
    'Бегущая строка внизу экрана. После каждого полного прохода переходит к следующему виду: позиции, лучшие круги, затем лучшая машина каждого производителя.',
  'Seconds Per Car': 'Секунд на машину',

  // Broadcast Events
  'Race control popups for the stream: incidents, yellow and black flags, with a card for the driver involved. Uses the Gantry incident detector and its thresholds.':
    'Всплывающие сообщения дирекции гонки для трансляции: инциденты, жёлтые и чёрные флаги, с карточкой причастного пилота. Использует детектор инцидентов Gantry и его пороги.',
  'Show Each Event For': 'Показывать каждое событие',
  'Incidents (crash, impact)': 'Инциденты (авария, удар)',
  'Slow / stopped car': 'Медленная или стоящая машина',
  'Off track': 'Вылет с трассы',
  'Black flag': 'Чёрный флаг',
  'Yellow flag': 'Жёлтый флаг',
  'Full course yellow': 'Жёлтый флаг на всей трассе',
  'Fastest lap in class': 'Лучший круг в классе',
  'Pit stop (pit lane time)': 'Пит-стоп (время на пит-лейне)',
  'Meatball (repair) flag': 'Чёрный флаг с оранжевым кругом (ремонт)',
  Disqualified: 'Дисквалификация',
  'Final lap (white flag)': 'Последний круг (белый флаг)',
  'Checkered flag with winner': 'Клетчатый флаг и победитель',

  // Broadcast Weather
  'Pops up with an animated card when rain starts or stops, the track gets wetter or dries, or track temperature swings by 3 degrees.':
    'Показывает анимированную карточку, когда начинается или прекращается дождь, трасса намокает или подсыхает либо температура трассы меняется на 3 градуса.',
  'Also Every (0 = Only On Change)': 'Также каждые (0 = только при изменении)',
  'Show For': 'Показывать в течение',

  // Broadcast Podium
  Steps: 'Ступени',
  Trophies: 'Кубки',
  'The top three of each class on steps, up after the checkered flag of a race. Demo mode shows it all the time so it can be placed.':
    'Тройка лидеров каждого класса на пьедестале; появляется после клетчатого флага гонки. В демо-режиме показывается постоянно, чтобы его можно было расположить.',
  'Gold, silver and bronze steps, or a trophy for each place.':
    'Золотая, серебряная и бронзовая ступени или кубок за каждое место.',

  // Fuel Calculator (widget page, layout editor, options, history)
  'Widget not found or loading...': 'Виджет не найден или загружается…',
  'Configure the Fuel Calculator layout.':
    'Настройка компоновки расчёта топлива.',
  'Only shown docked in the Gantry, never on the overlay.':
    'Показывается только в Gantry, на оверлее — никогда.',
  'Delete this layout configuration': 'Удалить эту компоновку',
  'Default (Locked)': 'Стандартная (защищена)',
  'Delete Layout': 'Удалить компоновку',
  'New Layout': 'Новая компоновка',
  History: 'История',
  'Drag to Split (Right/Bottom)': 'Перетащите, чтобы разделить (вправо/вниз)',
  'Font Sizes': 'Размеры шрифта',
  // Font size sliders: label text and value text of a fuel element
  Inside: 'Внутри',
  'Consumption Details': 'Подробности расхода',
  'Configures rows in Consumption Grid.': 'Строки таблицы расхода.',
  'Economy Predict': 'Прогноз экономии',
  'Predicts fuel usage vs target. Adjust Label/Value sizes.':
    'Прогноз расхода относительно цели. Настройте размеры подписи и значения.',
  'Used for Fuel History - see options.':
    'Используется для истории топлива — см. «Параметры».',
  'Fuel Scenarios': 'Сценарии заправки',
  'Pit stop calculations (-1, Ideal, +1 Lap).':
    'Расчёты пит-стопа (-1, оптимально, +1 круг).',
  'Target Message Font': 'Шрифт целевого сообщения',
  'Used for Pit Strategy - see options.':
    'Используется для стратегии пит-стопов — см. «Параметры».',
  'Fuel at End': 'Топливо на финише',
  'Shows the estimated fuel balance at race finish.':
    'Показывает расчётный остаток топлива на финише гонки.',
  'Fuel Consumption': 'Расход топлива',
  'Stops, Lap Window, and Confidence level. Adjust Label/Value sizes.':
    'Остановки, окно кругов и уровень достоверности. Настройте размеры подписи и значения.',
  'Confidence Messages': 'Сообщения о достоверности',
  'Text warnings when data is reliable/unreliable. Adjust Label/Value sizes.':
    'Текстовые предупреждения о надёжности данных. Настройте размеры подписи и значения.',
  'Fuel Gauge': 'Указатель топлива',
  'Visual circular fuel level indicator. Adjust Label/Value sizes.':
    'Круговой индикатор уровня топлива. Настройте размеры подписи и значения.',
  'Time Until Empty': 'Время до пустого бака',
  'Estimated driving time remaining. Adjust Label/Value sizes.':
    'Расчётное оставшееся время езды. Настройте размеры подписи и значения.',
  // Layout editor elements
  'Header (Stops/Window/Confidence)':
    'Верхняя панель (остановки/окно/достоверность)',
  'Consumption Grid': 'Таблица расхода',
  'Pit Scenarios': 'Сценарии пит-стопа',
  'Target Pit Message': 'Сообщение о целевом пит-стопе',
  'Fuel History': 'История топлива',
  'Economy Predict (Laps vs Target)': 'Прогноз экономии (круги и цель)',
  'Graph Properties': 'Свойства графика',
  'Target Line': 'Целевая линия',
  'Optional ref (0 to hide).': 'Необязательный ориентир (0 — скрыть).',
  'No fuel calculator widgets added yet.':
    'Виджеты расчёта топлива ещё не добавлены.',
  'Create New Widget': 'Создать виджет',
  'Fuel Status Alerts': 'Оповещения о топливе',
  'Green Threshold (%)': 'Порог зелёного (%)',
  'Amber Threshold (%)': 'Порог янтарного (%)',
  'Current Lap': 'Текущий круг',
  'Max Consumption': 'Макс. расход',
  'Min Consumption': 'Мин. расход',
  'Qualify Max': 'Макс. в квалификации',
  'Average Laps': 'Кругов для среднего',
  'Historical Storage': 'Хранение истории',
  'Clear Data Storage': 'Очистка данных',
  'Wipe all saved fuel consumption history from the database.':
    'Удалить из базы всю сохранённую историю расхода топлива.',
  'Clear All History': 'Очистить всю историю',
  'Pit Strategy': 'Стратегия пит-стопов',
  'Target Pit Lap': 'Целевой круг пит-стопа',
  'Scenarios will include this lap as a 4th row. Target message will show fuel required.':
    'Этот круг добавится в сценарии четвёртой строкой, а целевое сообщение покажет нужное количество топлива.',
  'Calculated From': 'Рассчитывать по',
  'Lap or laps to base the caluclation on.':
    'Круг или круги, по которым ведётся расчёт.',
  'Avg 10 Laps': 'Среднее за 10 кругов',
  'Max Lap': 'Макс. расход за круг',
  'Min Lap': 'Мин. расход за круг',

  // Gantry
  'Race control window with live standings, an incident feed and a lap gap graph.':
    'Окно дирекции гонки: позиции в реальном времени, лента инцидентов и график отставаний по кругам.',
  Incidents: 'Инциденты',
  'Docked Panels': 'Встроенные панели',
  'Gantry Window': 'Окно Gantry',
  'The Gantry runs in its own resizable window rather than as an on-screen overlay. Use this to bring it back if you closed it.':
    'Gantry работает в отдельном окне с изменяемым размером, а не как оверлей на экране. Эта кнопка вернёт окно, если вы его закрыли.',
  'The Gantry runs in its own resizable window rather than as an on-screen overlay. Use this to bring it back if you closed it. Turn the Gantry on above to open its window.':
    'Gantry работает в отдельном окне с изменяемым размером, а не как оверлей на экране. Эта кнопка вернёт окно, если вы его закрыли. Чтобы открыть окно, включите Gantry выше.',
  'Show Window': 'Показать окно',
  'Units for the speed settings on the Incidents tab. Values are always saved in km/h, so switching units never changes how incidents are detected.':
    'Единицы для настроек скорости на вкладке «Инциденты». Значения всегда хранятся в км/ч, поэтому смена единиц не влияет на обнаружение инцидентов.',
  'How names are written in the built-in Gantry standings list. Surname only keeps the column narrow, which is what the panel is sized for.':
    'Как записываются имена во встроенной таблице позиций Gantry. Только фамилия сохраняет столбец узким — на такую ширину и рассчитана панель.',
  'Incident Camera': 'Камера для инцидентов',
  'Which iRacing camera the incident replay buttons switch to. The list comes from the current session, so it fills in once you are on track. Falls back to the camera already selected when a track does not offer this group.':
    'Камера iRacing, на которую переключают кнопки повтора инцидентов. Список берётся из текущей сессии и заполняется, когда вы на трассе. Если на трассе нет этой группы камер, остаётся уже выбранная камера.',
  'Keep Sessions': 'Хранить сессии',
  'How many past sessions the Gantry keeps in its history. Lower it if the incident feed gets long and you only care about the current race; All keeps everything until you clear it.':
    'Сколько прошлых сессий Gantry хранит в истории. Уменьшите, если лента инцидентов слишком длинная, а вас интересует только текущая гонка; «Все» хранит всё, пока вы не очистите историю.',
  'Last 5': 'Последние 5',
  'Last 10': 'Последние 10',
  'Last 20': 'Последние 20',
  'Lap Graph': 'График кругов',
  'Default Y Axis': 'Ось Y по умолчанию',
  'What the Lap Graph tab measures when the Gantry opens. You can still switch axis on the tab itself.':
    'Что показывает вкладка Lap Graph при открытии Gantry. Ось можно переключить и на самой вкладке.',
  'Race Trace': 'Темп гонки',
  "How far ahead of or behind a reference pace each car is, lap by lap. A flat line means lapping exactly at the reference pace, and higher is better. The reference pace is the class leader's median lap.":
    'Насколько каждая машина опережает эталонный темп или отстаёт от него, круг за кругом. Горизонтальная линия — езда точно в эталонном темпе; чем выше, тем лучше. Эталонный темп — медианный круг лидера класса.',
  'Where each car ran in its class at the end of every lap. A line moving up is a place gained.':
    'Позиция каждой машины в классе в конце каждого круга. Линия, идущая вверх, — отыгранная позиция.',
  'Gap to Leader': 'Отставание от лидера',
  'How many seconds behind the class leader each car was at the end of every lap. The leader sits on zero.':
    'На сколько секунд каждая машина отставала от лидера класса в конце каждого круга. Лидер — на нуле.',
  'Y-axis range': 'Диапазон оси Y',
  'What the Race Trace and Gap axes are sized to. Shown drivers fits your car and the pinned cars, so a car far behind rides along the edge instead of flattening the battle you are watching. All drivers fits every car in the class.':
    'По каким машинам подбирается масштаб осей «Темп гонки» и «Отставание». «Показанные пилоты» — по вашей машине и закреплённым машинам, поэтому сильно отставшая машина идёт по краю и не сплющивает борьбу, за которой вы следите. «Все пилоты» — по всем машинам класса.',
  'Shown drivers': 'Показанные пилоты',
  'All drivers': 'Все пилоты',
  'Max gap shown (s)': 'Макс. отставание на графике (с)',
  'Pin Cars Automatically': 'Закреплять машины автоматически',
  'Start with your car, the class leader and the cars around you already drawn. Turn it off to open an empty graph and pick the cars yourself.':
    'График открывается с уже нарисованными вашей машиной, лидером класса и соседями. Выключите, чтобы открывать пустой график и выбирать машины самостоятельно.',
  'Incident Detection': 'Обнаружение инцидентов',
  'Slow Speed Threshold': 'Порог медленной скорости',
  'A car travelling below this speed counts as crawling. Raise it to also pick up cars limping back to the pits; lower it so only near-stationary cars are reported and you get fewer false alarms in slow corners.':
    'Машина медленнее этой скорости считается ползущей. Увеличьте, чтобы ловить и машины, еле добирающиеся до боксов; уменьшите, чтобы фиксировались только почти стоящие машины и было меньше ложных срабатываний в медленных поворотах.',
  'Slow For': 'Медленно в течение',
  'How long a car must stay below the slow speed before it is logged. Raise it to ignore brief lifts and hairpins; lower it to react sooner.':
    'Сколько машина должна ехать медленнее порога, чтобы попасть в ленту. Увеличьте, чтобы не учитывать короткие сбросы газа и шпильки; уменьшите, чтобы реагировать быстрее.',
  'Crash: Impact Severity': 'Авария: сила удара',
  'How much speed a car must shed each second for it to count as a crash. This is what separates a crash from braking: the hardest braking a road car manages is about 1.3g and a high-downforce car about 2.5g, while hitting a wall starts near 7g. The default sits at roughly 4g. Lower it to catch lighter contact; raise it if hard braking is being reported.':
    'Сколько скорости машина должна терять каждую секунду, чтобы это считалось аварией. Так авария отличается от торможения: самое сильное торможение дорожной машины — около 1,3g, машины с высокой прижимной силой — около 2,5g, а удар о стену начинается примерно с 7g. По умолчанию — около 4g. Уменьшите, чтобы ловить более лёгкие контакты; увеличьте, если в ленту попадают резкие торможения.',
  'Crash: Minimum Speed': 'Авария: минимальная скорость',
  'How fast a car must have been going for an impact to be worth reporting. Keeps pit-lane bumps and low-speed nudges out of the feed.':
    'С какой скоростью должна была ехать машина, чтобы удар стоило фиксировать. Не пускает в ленту толчки на пит-лейне и касания на малой скорости.',
  'Off-Track For': 'Вне трассы в течение',
  'How long a car must be off the racing surface before an off-track is logged. Raise it to ignore cars clipping a kerb or putting a wheel wide; lower it to catch every excursion.':
    'Сколько машина должна пробыть за пределами трассы, чтобы вылет попал в ленту. Увеличьте, чтобы не учитывать заезды на поребрик и колесо за линией; уменьшите, чтобы ловить каждый выезд.',
  'Pit Entry After': 'Заезд в боксы через',
  'How long a car must be on pit road before a pit entry is logged. Raise it to avoid false entries from cars hugging the pit exit line; lower it to log entries sooner.':
    'Сколько машина должна пробыть на пит-лейне, чтобы заезд в боксы попал в ленту. Увеличьте, чтобы избежать ложных заездов от машин, прижимающихся к линии выезда с пит-лейна; уменьшите, чтобы фиксировать заезды раньше.',
  'Per-Type Cooldown': 'Пауза для каждого типа',
  'How long to stay quiet before the same car can trigger the same kind of incident again. Raise it so one long spin does not fill the feed; lower it if you want every separate moment listed.':
    'Сколько ждать, прежде чем та же машина снова сможет вызвать инцидент того же типа. Увеличьте, чтобы один долгий разворот не заполнял ленту; уменьшите, если хотите видеть каждый отдельный момент.',

  // Gantry > Standings
  'Standings view': 'Вид таблицы позиций',
  'Built-in Gantry view': 'Встроенный вид Gantry',
  'Gantry-only standings layout': 'Таблица позиций только для Gantry',
  'The built-in view is the Gantry table with its fixed columns. The other two draw the full Standings widget, so every Standings option applies. A Gantry-only layout starts as a copy of the overlay settings and can then be changed without touching the overlay.':
    'Встроенный вид — таблица Gantry с фиксированными столбцами. Два других варианта рисуют полноценный виджет «Таблица позиций», поэтому действуют все его настройки. Вариант только для Gantry начинается как копия настроек оверлея, и его можно менять, не затрагивая оверлей.',
  "Uses the overlay Standings settings as they are. The Gantry always lists every driver and ignores the overlay's visibility rules.":
    'Использует настройки оверлея «Таблица позиций» как есть. Gantry всегда показывает всех пилотов и не учитывает правила видимости оверлея.',
  'Create Gantry standings layout (copy of overlay)':
    'Создать таблицу позиций для Gantry (копию оверлея)',
  'Edit standings layout': 'Изменить таблицу позиций',
  'Copy settings from overlay': 'Скопировать настройки с оверлея',
  'The Gantry-only standings layout was removed. The built-in view is showing until you create another.':
    'Таблица позиций только для Gantry удалена. Пока вы не создадите новую, показывается встроенный вид.',
  'No Gantry-only layout yet. The built-in view is showing until you create one.':
    'Таблицы только для Gantry пока нет. Пока вы её не создадите, показывается встроенный вид.',

  // Gantry > Docked Panels
  'Panel type': 'Тип панели',
  Source: 'Источник',
  'Choose a fuel layout': 'Выберите компоновку расчёта топлива',
  // Followed by the removed layout's id
  'Removed layout:': 'Удалённая компоновка:',
  'Remove panel': 'Удалить панель',
  'Create Gantry fuel layout': 'Создать компоновку топлива для Gantry',
  'Edit fuel layout': 'Изменить компоновку топлива',
  // "Uses the <widget> settings." split around the widget name
  'Uses the': 'Использует виджет',
  'settings.': 'и его настройки.',
  // "Edit <widget> settings" (button), after the shared "Edit"
  settings: '(настройки)',
  'The fuel layout this panel used was removed. Choose another.':
    'Компоновка топлива этой панели удалена. Выберите другую.',
  'This panel uses a Gantry-only fuel layout. Delete the layout too?':
    'Эта панель использует компоновку топлива только для Gantry. Удалить и компоновку?',
  'Delete layout': 'Удалить компоновку',
  'Keep layout': 'Оставить компоновку',
  'Show docked panels below the incident feed':
    'Показывать встроенные панели под лентой инцидентов',
  'Shows overlay widgets such as the fuel calculator and track map under the incident feed on the Standings & Incidents tab. Drag the divider in the Gantry to resize them.':
    'Показывает виджеты оверлея, например расчёт топлива и карту трассы, под лентой инцидентов на вкладке Standings & Incidents. Размер меняется перетаскиванием разделителя в Gantry.',
  Arrangement: 'Расположение',
  'Side by side shows every panel at once. Tabs shows one at a time, which suits a narrow window.':
    '«Рядом» показывает все панели сразу, «Вкладки» — по одной, что удобно для узкого окна.',
  'Side by side': 'Рядом',
  Tabs: 'Вкладки',
  Panels: 'Панели',
  // "Drag to reorder. Up to <3> panels. A fuel panel …", split around the number
  'Drag to reorder. Up to': 'Перетаскивайте, чтобы изменить порядок. До',
  'panels. A fuel panel can show one of your overlay fuel layouts, or a Gantry-only layout that never appears on the overlay. Track maps use their own settings.':
    'панелей. Панель топлива может показывать одну из ваших компоновок расчёта топлива для оверлея или компоновку только для Gantry, которая не появляется на оверлее. Карты трассы используют собственные настройки.',
  'No panels yet.': 'Панелей пока нет.',

  // Session bar items (Standings / Relative header and footer)
  'Session Name': 'Название сессии',
  'Session Laps': 'Круги сессии',
  'Incident Count': 'Число инцидентов',
  'Brake Bias': 'Баланс тормозов',
  'Local Time': 'Местное время',
  'Session Clock Time': 'Время суток в сессии',
  'Track Wetness': 'Влажность трассы',
  'Top Speed': 'Макс. скорость',
  'Manufacturer Position': 'Позиция среди марок',
  'Class Rank': 'Место в классе',
  // Prefix of a fuel widget page title, "<prefix> - <widget id>"
  'Fuel Calculator Settings': 'Настройки расчёта топлива',

  // Garage Cover
  'Configure settings for the garage cover widget that displays when in the garage.':
    'Настройки заставки, которая показывается, когда вы в гараже.',
  'Note:': 'Примечание:',
  'The garage cover is intended for use whilst streaming. It only appears when you have the garage window open in iRacing.':
    'заставка в гараже предназначена для трансляций. Она появляется, только когда в iRacing открыто окно гаража.',
  'Browser Source URL:': 'Ссылка для браузерного источника:',
  'Garage Image': 'Изображение заставки',
  'Garage preview': 'Превью заставки',
  'Click or drag to replace image':
    'Нажмите или перетащите файл, чтобы заменить изображение',
  'Drag and drop an image here': 'Перетащите изображение сюда',
  'or click to select an image': 'или нажмите, чтобы выбрать файл',
  'Remove Image': 'Удалить изображение',

  // Heart Rate
  'Display your live heart rate via HypeRate — no API key needed.':
    'Показывает ваш пульс в реальном времени через HypeRate — API-ключ не нужен.',
  'Session ID': 'ID сессии',
  'e.g. KiY': 'например, KiY',
  // "… share link (app.hyperate.io/<KiY>). No account …", split around KiY
  'The code at the end of your HypeRate share link (app.hyperate.io/':
    'Код в конце вашей ссылки HypeRate для общего доступа (app.hyperate.io/',
  '). No account or API key required.': '). Аккаунт и API-ключ не нужны.',
  'Widget / theme': 'Виджет / тема',
  '(optional)': '(необязательно)',
  'e.g. Bouncing_Heart_Widget': 'например, Bouncing_Heart_Widget',
  // "… — e.g. <name> or <url>. Your Session ID …", split around the examples
  'Pick a widget on hyperate.io and paste its link or just the name — e.g.':
    'Выберите виджет на hyperate.io и вставьте его ссылку или только название, например',
  '. Your Session ID is filled in automatically. Leave blank for the default animated heart.':
    '. ID сессии подставится автоматически. Оставьте поле пустым, чтобы показывать стандартное анимированное сердце.',

  // Information Bar
  'A standalone bar displaying session and timing information.':
    'Отдельная панель со сведениями о сессии и времени.',
  'Enable and reorder items for the information bar.':
    'Включайте элементы информационной панели и меняйте их порядок.',

  // Input
  'Configure the input traces display settings for throttle, brake, and clutch.':
    'Настройка графиков газа, тормоза и сцепления.',
  'Delete this input widget': 'Удалить этот виджет педалей и руля',
  'Delete Widget': 'Удалить виджет',
  'New Input Widget': 'Новый виджет педалей и руля',
  'This layout shows no elements. Use Reset to Default Layout to start editing.':
    'В этой компоновке нет элементов. Нажмите «Вернуть стандартную компоновку», чтобы начать редактирование.',
  'Reset to Default Layout': 'Вернуть стандартную компоновку',
  'Shift Flash': 'Вспышка при переключении',
  'Flash Layout at Shift Point': 'Вспышка в точке переключения',
  'Flash the whole layout background when it is time to shift':
    'Фон всего виджета вспыхивает, когда пора переключать передачу',
  'Flash At': 'Вспышка при',
  'Shift Points uses the custom shift points set for this car in the Tachometer settings. Gears without one use the redline.':
    '«Точки переключения» берут точки переключения, заданные для этой машины в настройках тахометра. Для передач без них используется красная зона.',
  Redline: 'Красная зона',
  'Shift Points': 'Точки переключения',
  'Flash Color': 'Цвет вспышки',
  'Gear Flash': 'Подсветка передачи',
  'Flash Gear on Shift': 'Подсвечивать передачу при переключении',
  'Briefly color the gear number on an upshift or downshift':
    'Ненадолго окрашивать номер передачи при переключении вверх или вниз',
  'Upshift Color': 'Цвет при повышении',
  'Downshift Color': 'Цвет при понижении',
  // Section and layout element names
  Trace: 'График',
  Bar: 'Шкалы',
  Steer: 'Руль',
  'How ABS is shown in the trace': 'Как ABS показывается на графике',

  // Lap Timer
  'Configure settings for the Lap Timer widget. Select the lap times you want to see and the display options.':
    'Настройки таймера круга. Выберите, какое время кругов показывать и как его отображать.',

  // Lap Trace
  "Plots a saved lap's throttle, brake and speed against position on track, in a window that slides with your car, drawn pastel as a background target. Your current lap is drawn over it as a bright ghost so you can see where the reference brakes and gets back on power.":
    'Строит газ, тормоз и скорость сохранённого круга по положению на трассе в окне, которое движется вместе с вашей машиной; эталон рисуется пастельными цветами как фоновая цель. Текущий круг рисуется поверх яркой тенью, чтобы было видно, где эталон тормозит и снова открывает газ.',
  Corner: 'Поворот',
  Braking: 'Торможение',
  Help: 'Справка',
  'Reference Lap': 'Эталонный круг',
  'Start driving to manage the best lap for the current track and car.':
    'Начните ездить, чтобы управлять лучшим кругом для текущих трассы и машины.',
  'Reset your recorded best lap for the track and car you are driving now. The next clean lap becomes the new best.':
    'Сбросить записанный лучший круг для трассы и машины, на которых вы сейчас едете. Новым лучшим станет следующий чистый круг.',
  'Reset my best lap': 'Сбросить мой лучший круг',
  'Import a lap exported from Garage 61 as a CSV file to use as the reference.':
    'Импортируйте круг, экспортированный из Garage 61 в CSV, чтобы использовать его как эталон.',
  // Followed by the imported lap's details
  'Imported:': 'Импортировано:',
  'Lap Time:': 'Время круга:',
  'Driver:': 'Пилот:',
  'Car:': 'Машина:',
  'Track:': 'Трасса:',
  'Find laps on Garage 61': 'Найти круги в Garage 61',
  'Import Garage 61 Lap': 'Импортировать круг Garage 61',
  "Import a saved iRacing .ibt telemetry file. Only the fastest clean lap in the file is kept, matched to that lap's own track and car.":
    'Импортируйте сохранённый файл телеметрии iRacing (.ibt). Сохраняется только самый быстрый чистый круг из файла — с привязкой к его трассе и машине.',
  'Importing…': 'Импорт…',
  'Import .ibt Lap': 'Импортировать круг .ibt',
  'How much track behind the car is visible':
    'Сколько трассы позади машины видно',
  Channels: 'Каналы',
  'Last Corner': 'Последний поворот',
  'Corner History Column Order': 'Порядок столбцов истории поворотов',
  'Drag columns to choose their left-to-right order. Empty delta cells keep their column so history stays aligned.':
    'Перетаскивайте столбцы, чтобы задать их порядок слева направо. Пустые ячейки дельты сохраняют свой столбец, поэтому история остаётся выровненной.',
  'Corner Time Delta': 'Дельта времени поворота',
  'Brake Point Delta': 'Дельта точки торможения',
  'Min Speed Delta': 'Дельта мин. скорости',
  'Brake Point Countdown': 'Отсчёт до точки торможения',
  'Minimum brake pressure': 'Минимальное давление тормоза',
  'How hard the reference lap had to press for a brake application to count as a braking zone, and so earn a countdown and a brake-distance delta. Raise it if light stabilising brushes inside fast corners are being counted; lower it if a real corner brake point is being missed. Depends on the car, since brake bias and pedal travel differ.':
    'Насколько сильно нужно было нажать тормоз на эталонном круге, чтобы нажатие считалось зоной торможения и получило отсчёт и дельту дистанции торможения. Увеличьте, если учитываются лёгкие стабилизирующие касания в быстрых поворотах; уменьшите, если пропускается настоящая точка торможения. Зависит от машины: баланс тормозов и ход педали у них разные.',
  'Bar Position': 'Положение полос',
  'Left/Right run a full-height column of 4 bars beside the trace that drain 3, 2 and 1 second before your reference lap braked. Top/Bottom run a single continuous bar across the width instead.':
    '«Слева» и «Справа» — столбец из 4 полос во всю высоту рядом с графиком; полосы убывают за 3, 2 и 1 секунду до торможения на эталонном круге. «Сверху» и «Снизу» — одна сплошная полоса во всю ширину.',
  'Audio Output Device': 'Устройство вывода звука',
  'Which Windows playback device the countdown tones use. Default follows whatever Windows is set to.':
    'Через какое устройство воспроизведения Windows звучат сигналы отсчёта. «По умолчанию» следует настройке Windows.',
  'Default (Windows)': 'По умолчанию (Windows)',
  'Selected device (not connected)': 'Выбранное устройство (не подключено)',
  'Cue Volume': 'Громкость сигналов',
  'How loud the countdown tones are': 'Громкость сигналов отсчёта',
  'Sound at 3 seconds': 'Сигнал за 3 секунды',
  'Sound at 2 seconds': 'Сигнал за 2 секунды',
  'Sound at 1 seconds': 'Сигнал за 1 секунду',
  'Sound at brake point': 'Сигнал в точке торможения',
  Frequency: 'Частота',
  Waveform: 'Форма волны',
  Sine: 'Синусоида',
  Triangle: 'Треугольник',
  Square: 'Меандр',
  Sawtooth: 'Пила',
  Duration: 'Длительность',
  Level: 'Уровень',
  'Test sound': 'Проверить звук',
  'Test Sound': 'Проверка звука',
  'Plays the three beeps and the brake tone here in Settings, so you can tune them without being on track.':
    'Проигрывает три сигнала отсчёта и сигнал торможения прямо в настройках, чтобы их можно было подобрать, не выезжая на трассу.',
  'Restore default sound': 'Вернуть звук по умолчанию',
  'Reference Opacity': 'Непрозрачность эталона',
  'How prominent the saved reference lap is (lines and bars)':
    'Насколько заметен сохранённый эталонный круг (линии и полосы)',
  'Driver Input Opacity': 'Непрозрачность вашего ввода',
  'How prominent the live driver input trace is':
    'Насколько заметен текущий график ваших педалей',
  'Plot Colors': 'Цвета графика',
  'Restore defaults': 'Вернуть по умолчанию',
  'Ref Throttle': 'Эталон: газ',
  'Ref Brake': 'Эталон: тормоз',
  'Ref Speed': 'Эталон: скорость',
  'Throttle fill': 'Заливка газа',
  'Brake fill': 'Заливка тормоза',
  'ABS fill': 'Заливка ABS',
  'Throttle marker': 'Метка газа',
  'Brake marker': 'Метка торможения',
  'Car line': 'Линия машины',
  'Grid line': 'Линии сетки',
  'Countdown Colors': 'Цвета отсчёта',
  'Armed (green)': 'Готовность (зелёный)',
  '2 seconds (amber)': '2 секунды (янтарный)',
  '1 second (orange)': '1 секунда (оранжевый)',
  'Brake point (red)': 'Точка торможения (красный)',

  // Lap Trace > Help
  'Importing a reference lap': 'Импорт эталонного круга',
  "Lap Trace plots a saved lap against the one you are driving. Your own best lap is recorded automatically. The two import options below let you compare against someone else's lap, or against a lap from a previous session.":
    'Телеметрия круга сравнивает сохранённый круг с тем, который вы проезжаете. Ваш лучший круг записывается автоматически. Два способа импорта ниже позволяют сравнить себя с кругом другого пилота или с кругом из прошлой сессии.',
  'Garage 61 CSV': 'CSV из Garage 61',
  'Garage 61 stores laps shared by other drivers. Export one as a CSV and import it here.':
    'В Garage 61 хранятся круги, которыми поделились другие пилоты. Экспортируйте круг в CSV и импортируйте его сюда.',
  'Open the lap in Garage 61 and use its export option to download the lap as CSV.':
    'Откройте круг в Garage 61 и скачайте его в формате CSV через экспорт.',
  'Click on the down arrow next to Analyze to get to the "Export to CSV" option.':
    'Нажмите стрелку вниз рядом с Analyze, чтобы открыть пункт «Export to CSV».',
  'The Garage 61 toolbar, with the menu beside the Analyze button open on Copy lap ID, Export to CSV and View event':
    'Панель инструментов Garage 61 с открытым меню рядом с кнопкой Analyze: Copy lap ID, Export to CSV и View event',
  // "Back here, choose <Import Garage 61 Lap> on the Trace tab and pick the file."
  'Back here, choose': 'Вернитесь сюда, нажмите',
  'on the Trace tab and pick the file.': 'на вкладке «График» и выберите файл.',
  'Keep the filename as Garage 61 wrote it. It carries the driver, car, track and lap time, which become the label on the widget. A renamed file still imports, and is labelled with the filename instead.':
    'Не переименовывайте файл, созданный Garage 61: в имени есть пилот, машина, трасса и время круга, из которых складывается подпись на виджете. Переименованный файл тоже импортируется, но подписью станет имя файла.',
  // Followed by the (monospace) column names
  'The export must contain these columns:': 'Экспорт должен содержать столбцы:',
  '. Latitude and longitude are how the track length is worked out, so an export without them cannot be used.':
    '. По широте и долготе вычисляется длина трассы, поэтому экспорт без них использовать нельзя.',
  'There is one Garage 61 slot, not one per track. Importing a new lap replaces the previous one.':
    'Для Garage 61 есть одна ячейка, а не по одной на трассу. Новый импортированный круг заменяет предыдущий.',
  'Open Garage 61': 'Открыть Garage 61',
  'iRacing .ibt telemetry': 'Телеметрия iRacing (.ibt)',
  // "An <.ibt> file is the telemetry …", split around the extension
  An: 'Файл',
  'file is the telemetry iRacing writes for a session on your own computer. Importing one lets you compare against a lap you drove earlier.':
    '— это телеметрия, которую iRacing записывает за сессию на вашем компьютере. Импорт позволяет сравнить себя с кругом, который вы проехали ранее.',
  'Be sure telemetry recording in iRacing is on. The sim writes a file per session.':
    'Убедитесь, что в iRacing включена запись телеметрии. Симулятор пишет по файлу на сессию.',
  // "Choose <Import .ibt Lap> on the Trace tab. The picker opens …"
  Choose: 'Нажмите',
  'on the Trace tab. The picker opens your telemetry folder.':
    'на вкладке «График». Окно выбора откроется в папке телеметрии.',
  // Followed by the (monospace) folder path and "."
  'Telemetry files are written by iRacing to':
    'iRacing записывает файлы телеметрии в папку',
  'Only the fastest clean lap in the file is kept. There is one slot, so importing a new file replaces the previous one.':
    'Сохраняется только самый быстрый чистый круг из файла. Ячейка одна, поэтому новый файл заменяет предыдущий.',
  'These files are large, often hundreds of megabytes. Only the one lap is stored, so importing does not keep the file.':
    'Эти файлы большие, часто сотни мегабайт. Сохраняется только один круг, сам файл после импорта не хранится.',
  'When nothing appears': 'Если ничего не появляется',
  'Check the Reference Lap setting on the Trace tab is set to the source you imported.':
    'Проверьте, что в настройке «Эталонный круг» на вкладке «График» выбран импортированный источник.',
  'For a Garage 61 lap, confirm the export covers a complete lap. An out lap or a partial lap has no start and finish crossing to measure against.':
    'Для круга из Garage 61 убедитесь, что экспорт содержит полный круг. У выездного или неполного круга нет пересечения линии старта-финиша, от которого можно вести отсчёт.',
  Limitations: 'Ограничения',
  'Corner names come from bundled track data':
    'Названия поворотов берутся из встроенных данных о трассах',
  'The Last Corner panel and corner names come from the Lovely Sim Racing dataset bundled with irDashies, not from iRacing, and it does not cover every layout. Where a layout is missing, the Last Corner panel does not appear at all. There is no warning, because there is nothing to show.':
    'Панель последних поворотов и названия поворотов берутся из набора данных Lovely Sim Racing, встроенного в irDashies, а не из iRacing, и он охватывает не все конфигурации трасс. Если конфигурации нет, панель последних поворотов вообще не появляется. Предупреждения нет, потому что показывать нечего.',
  'Coverage is per layout, not per circuit, so a circuit can have data for one layout and none for another.':
    'Данные привязаны к конфигурации, а не к трассе целиком, поэтому для одной конфигурации трассы они могут быть, а для другой — нет.',
  "Some layouts have corner positions but no names. Those corners are numbered instead, and the numbering will not always match iRacing's own.":
    'Для некоторых конфигураций известны положения поворотов, но не названия. Такие повороты нумеруются, и нумерация не всегда совпадает с принятой в iRacing.',
  'The brake countdown does not need any of this. It reads brake points from the reference lap itself, so it works wherever the corner panel does not.':
    'Отсчёту до торможения всё это не нужно: он берёт точки торможения из самого эталонного круга, поэтому работает и там, где нет панели поворотов.',
  'A reference lap from elsewhere is stretched to fit':
    'Эталонный круг с другой трассы растягивается под текущую',
  'Imported laps are held in one slot each, not one per circuit, so they are shown whatever you are driving. When the imported lap came from a track of a different length, its distances are rescaled to the current one. The trace will draw, but nothing on it lines up with the road you are on.':
    'Каждый импортированный круг хранится в одной ячейке, а не по одной на трассу, поэтому он показывается, где бы вы ни ехали. Если круг проехан на трассе другой длины, его дистанция масштабируется под текущую. График нарисуется, но ничего на нём не совпадёт с дорогой, по которой вы едете.',
  'Garage 61 exports carry no clock': 'В экспорте Garage 61 нет времени',
  'The CSV has no time column, so lap time and per-sample timing are reconstructed by integrating speed over the GPS positions. Good enough to plot against, but not a measured lap time.':
    'В CSV нет столбца времени, поэтому время круга и время каждого отсчёта восстанавливаются интегрированием скорости по GPS-координатам. Для графика этого достаточно, но это не измеренное время круга.',
  "Those exports also record pedal positions after iRacing's own input processing, while your live trace is raw pedal travel. On a car with driving aids the two are measured differently, and the reference will look smoother than the driver was.":
    'Кроме того, в этих экспортах положение педалей записано после обработки ввода в самом iRacing, а ваш текущий график — необработанный ход педалей. На машине с электронными помощниками они измеряются по-разному, и эталон будет выглядеть плавнее, чем ехал пилот.',
  'What invalidates a personal best': 'Что отменяет личный рекорд',
  'Your own best lap is only recorded from a clean lap. Going off track, picking up an incident, entering the pits, or a gap in telemetry all disqualify the lap in progress. So does an Active Reset or a tow, which discards the lap and restarts recording where the car reappears.':
    'Ваш лучший круг записывается только с чистого круга. Вылет с трассы, инцидент, заезд в боксы или пропуск в телеметрии делают текущий круг недействительным. Так же действуют Active Reset и эвакуация: круг отбрасывается, и запись начинается заново там, где машина появится.',
  'The countdown is quiet in a replay': 'В повторе отсчёт молчит',
  'Brake cues are suppressed during replay playback, in the pits, and whenever you are not on track.':
    'Сигналы торможения отключаются при просмотре повтора, в боксах и всегда, когда вы не на трассе.',
  'Not every touch of the brake is a braking zone':
    'Не каждое касание тормоза — зона торможения',
  "A brake marker is drawn wherever the reference lap touched the pedal at all. A countdown and a brake-distance delta need more than that: the application has to reach the Minimum brake pressure setting and to have actually slowed the car. That keeps a brush taken to settle the car mid-corner from beeping at you and from stealing the corner's brake-point comparison.":
    'Метка торможения ставится везде, где на эталонном круге педаль хоть немного нажималась. Для отсчёта и дельты дистанции торможения нужно больше: нажатие должно достичь значения «Минимальное давление тормоза» и действительно замедлить машину. Так лёгкое касание для стабилизации машины в повороте не вызывает сигнал и не подменяет сравнение точки торможения в этом повороте.',
  'So a marker with no beep behind it means that application was judged too light. If it was a real brake point, lower Minimum brake pressure; if light touches are being counted, raise it. Cars differ — brake bias and pedal travel are not the same from one to the next, and some log pedal force rather than travel.':
    'Поэтому метка без сигнала означает, что нажатие сочтено слишком слабым. Если это была настоящая точка торможения, уменьшите «Минимальное давление тормоза»; если учитываются лёгкие касания — увеличьте. Машины различаются: баланс тормозов и ход педали у них разные, а некоторые записывают усилие на педали, а не ход.',

  // Radar page
  'A close-range radar centred on your car. The road turns with you, so the cars around you sit where they are on track.':
    'Радар ближней зоны с центром на вашей машине. Дорога поворачивается вместе с вами, поэтому машины вокруг стоят там же, где на трассе.',
  Other: 'Другое',
  // Settings level (Basic / Advanced / Dev), the rail group and the badge
  Basic: 'Базовые',
  Dev: 'Служебные',
  Adv: 'Расш.',
  'Internals the radar was tuned on. Odd values break lanes and warnings; Reset section puts them back.':
    'Внутренние параметры, на которых настраивался радар. Странные значения ломают ряды и предупреждения; «Сбросить раздел» вернёт их.',
  'Off. Turn it on to see its settings.':
    'Выключено. Включите, чтобы увидеть настройки.',
  'Rim Arc': 'Дуга на краю',
  'Off, set in Arcs': 'Выкл., настраивается в разделе «Дуги»',
  'Nothing here at this level. Advanced shows more.':
    'На этом уровне здесь ничего нет. Больше — в «Расширенных».',
  Road: 'Шоссе',
  Oval: 'Овал',
  'Pick by Track': 'Выбирать по трассе',
  'Use the oval profile on ovals. Look, distances and warnings are kept per profile.':
    'Использовать профиль «Овал» на овалах. Внешний вид, расстояния и предупреждения хранятся отдельно для каждого профиля.',
  Preset: 'Пресет',
  'Find a setting': 'Найти настройку',
  'Find a setting…': 'Найти настройку…',
  'Radar settings sections': 'Разделы настроек радара',
  'No setting matches. The search looks through every level, Dev included.':
    'Ничего не найдено. Поиск идёт по всем уровням, включая служебные.',
  'Radar preview': 'Предпросмотр радара',
  'Pole side key': 'Клавиша стороны поула',
  'In some cases the radar may draw the lanes on the wrong side at a start, restart or standing grid, because the sim does not say which side the pole line is on. The key flips the side on the current track and remembers it for future races.':
    'Иногда на старте, рестарте или при старте с места радар рисует ряды не с той стороны, потому что симулятор не сообщает, с какой стороны линия поула. Клавиша меняет сторону на текущей трассе и запоминает её для будущих гонок.',
  // Radar sections and items
  'Show Radar': 'Показывать радар',
  'Only when a car is near keeps the radar off screen the rest of the time.':
    '«Когда рядом машина» убирает радар с экрана в остальное время.',
  Always: 'Всегда',
  'When a car is near': 'Когда рядом машина',
  'Show Within': 'Показывать ближе',
  'The radar appears when a car comes this close.':
    'Радар появляется, когда машина подъезжает на это расстояние.',
  'Hide Beyond': 'Скрывать дальше',
  'The radar leaves once every car is further than this. Kept above Show Within so it does not blink.':
    'Радар исчезает, когда все машины дальше этого расстояния. Значение всегда больше, чем «Показывать ближе», чтобы радар не мигал.',
  Sessions: 'Сессии',
  'Race, qualifying, practice, warmup, testing.':
    'Гонка, квалификация, практика, разминка, тесты.',
  'Rival Colour': 'Цвет соперников',
  'Colour rivals by licence (as on the rating badge), by car class, or all the same.':
    'Окрашивать соперников по лицензии (как на значке рейтинга), по классу машины или одинаково.',
  'Licence (safety rating)': 'Лицензия (Safety Rating)',
  'Car class': 'Класс машины',
  'Rival Fill': 'Заливка соперников',
  'A paler shade of your car.': 'Более бледный оттенок вашей машины.',
  'Your own pick.': 'Ваш собственный выбор.',
  'Your Car': 'Ваша машина',
  Arcs: 'Дуги',
  'Marks on the rim towards a car worth watching. Every arc is here: whether it shows, how it looks and how long it is.':
    'Отметки на краю радара в сторону машины, за которой стоит следить. Здесь все дуги: показывать ли их, как они выглядят и какой они длины.',
  'Close Cars': 'Близкие машины',
  'Towards a car close by or alongside.':
    'В сторону машины, которая рядом или вплотную сбоку.',
  'Dive-Bomb': 'Атака сзади',
  'Towards a car closing fast from behind or diving in.':
    'В сторону машины, которая быстро догоняет сзади или ныряет внутрь.',
  'Hazards Ahead': 'Опасность впереди',
  'Under the hazard triangle. Off leaves the triangle and the distance.':
    'Под треугольником опасности. Если выключено, остаются треугольник и расстояние.',
  'Half the arc either side of the car: for one far off, and one right beside you.':
    'Половина дуги по обе стороны от машины: для далёкой машины и для машины вплотную к вам.',
  'Far off at the smallest, at the edge of the disc at the largest.':
    'Наименьшая — для далёкой машины, наибольшая — у края диска.',
  'Outlines on the car and arcs on the rim: amber when a car is close, pulsing red when it is alongside.':
    'Контуры на машине и дуги на краю: янтарные, когда машина близко, и пульсирующие красные, когда она сбоку.',
  Warn: 'Предупреждать',
  'How close a car gets before it turns amber.':
    'На каком расстоянии машина становится янтарной.',
  // Warn: Early / Normal / Late
  Early: 'Ранний',
  Late: 'Поздний',
  'Warning Colours': 'Цвета предупреждений',
  'Close and alongside.': 'Близко и сбоку.',
  Close: 'Близко',
  Alongside: 'Сбоку',
  'Colour-blind friendly': 'Для дальтоников',
  Overlap: 'Перекрытие',
  'A strip along the side a car is on, showing how far it reaches along your car. It turns red once the car is owed room. When you attack, it shows on their car how far along it you reach.':
    'Полоса вдоль борта, у которого находится машина, показывает, насколько далеко она заходит вдоль вашей машины. Полоса краснеет, когда машине положено оставить место. Когда атакуете вы, она показывает на чужой машине, насколько далеко заходите вы.',
  'Room Owed From': 'Когда положено место',
  'How far alongside a car must be before it is owed room.':
    'Насколько машина должна зайти сбоку, чтобы ей было положено место.',
  'Rear wheel': 'Заднее колесо',
  Door: 'Дверь',
  'Front wheel': 'Переднее колесо',
  'Warns about a car coming up much faster from behind before it gets to your side: amber while it closes, then pulsing red and a dashed outline where it is about to be. Off under yellow, behind the pace car and on pit road.':
    'Предупреждает о машине, которая догоняет сзади намного быстрее, ещё до того как она окажется сбоку: янтарный, пока она сближается, затем пульсирующий красный и пунктирный контур там, где она вот-вот окажется. Не работает под жёлтым флагом, за пейс-каром и на пит-лейне.',
  'Marks a car ahead that crashed, crawls, went off or is coming back on, before it comes into view: a triangle on the rim in its direction along the track, with how far it is. Brings the radar up when auto-hide has it away. Off under a full-course caution and behind the pace car.':
    'Отмечает машину впереди, которая разбилась, ползёт, вылетела или возвращается на трассу, ещё до того как она появится в поле зрения: треугольник на краю радара в её направлении по трассе и расстояние до неё. Показывает радар, даже если он скрыт автоматически. Не работает при жёлтом флаге на всей трассе и за пейс-каром.',
  'Car Sizes': 'Размеры машин',
  'Class Sizes': 'Размеры классов',
  'Length and width for each class in this session.':
    'Длина и ширина для каждого класса в этой сессии.',
  'Join a session to adjust the size of each class in it.':
    'Подключитесь к сессии, чтобы настроить размер каждого класса в ней.',
  // Class size row: the size iRacing does not report, so a typical one is used
  typical: 'типичный',
  Length: 'Длина',
  Processing: 'Обработка',
  'Weight of the newest sample in the per-car speed average at 25 updates a second, 0-1. Lower is smoother but lags.':
    'Вес нового отсчёта в средней скорости машины при 25 обновлениях в секунду, 0–1. Меньше — плавнее, но с запаздыванием.',
  'Seconds a car is moved on between snapshots, at most.':
    'Максимум секунд, на которые машина сдвигается вперёд между снимками.',
  'Lanes per second a car slides when its lane changes.':
    'Сколько рядов в секунду проходит машина при смене ряда.',
  'Metres between cars in neighbouring lanes.':
    'Метров между машинами в соседних рядах.',
  'Metres searched for the cars the spotter calls, when none overlap.':
    'Сколько метров просматривать в поисках машин, о которых сообщает споттер, если ни одна не перекрывается.',
  'Below this speed, in m/s, cars count as parked on the grid.':
    'Ниже этой скорости (м/с) машины считаются стоящими на стартовой решётке.',
  'Car numbers are left out on cars drawn smaller than this, in px.':
    'Номера не пишутся на машинах, нарисованных меньше этого размера (px).',
  Debug: 'Отладка',
  'Car Index and Lane': 'Индекс машины и ряд',
  'Write each car index and lane next to it on the radar.':
    'Писать индекс и ряд каждой машины рядом с ней на радаре.',
  'Frame Time': 'Время кадра',
  'Write how long a frame takes to draw.': 'Писать, сколько рисуется кадр.',
  Tools: 'Инструменты',
  'Export / Import': 'Экспорт / импорт',
  'The whole radar config as JSON, to share or attach.':
    'Вся конфигурация радара в JSON — чтобы поделиться или приложить.',
  'Radar settings as JSON': 'Настройки радара в JSON',
  'Apply Pasted': 'Применить вставленное',
  Discard: 'Отменить',
  'Expected a JSON object of settings.': 'Ожидается JSON-объект с настройками.',
  'Applied.': 'Применено.',
  'Copied.': 'Скопировано.',
  'Could not copy; select the text and copy it by hand.':
    'Не удалось скопировать: выделите текст и скопируйте его вручную.',
  // Presets
  Minimal: 'Минимальный',
  'Cars only': 'Только машины',
  'The defaults': 'Значения по умолчанию',
  Detailed: 'Подробный',
  'Road, rings, numbers': 'Дорога, кольца, номера',
  // Arc styles
  Arc: 'Дуга',
  'A solid arc on the rim.': 'Сплошная дуга на краю.',
  Segments: 'Сегменты',
  'Three short strokes; the more urgent, the more of them light.':
    'Три коротких штриха; чем опаснее ситуация, тем больше их горит.',
  Glow: 'Свечение',
  'A soft band in from the rim, with no hard edge. Calmer to see.':
    'Мягкая полоса от края внутрь, без резкой границы. Спокойнее для глаз.',
  Sector: 'Сектор',
  'A see-through wedge from your car towards the other: the direction reads even from the corner of your eye.':
    'Полупрозрачный клин от вашей машины к другой: направление считывается даже боковым зрением.',

  // Standings and Relative (columns, tabs, sections)
  'Country Flags': 'Флаги стран',
  'Pit Status': 'Статус пит-стопа',
  'Car Manufacturer': 'Производитель машины',
  'Driver Tag': 'Метка пилота',
  Rating: 'Рейтинг',
  'iRating Change': 'Изменение iRating',
  'Position Change': 'Изменение позиции',
  'Tire Compound': 'Состав шин',
  'Lap Time Deltas': 'Дельты времени кругов',
  'Avg Lap Time': 'Среднее время круга',
  'Lap Count': 'Число кругов',
  'Lap Delta': 'Дельта круга',
  'LMU Virtual Energy': 'Виртуальная энергия LMU',
  'Negative ahead, positive behind, across all classes. Uses track position in races and best laps in practice and qualifying. Follows the camera car when spectating.':
    'Отрицательное впереди, положительное позади, по всем классам. В гонках используется положение на трассе, в практике и квалификации — лучшие круги. При просмотре — относительно машины в камере.',
  'Configure how the standings widget appears and behaves.':
    'Настройка внешнего вида и поведения таблицы позиций.',
  'Only shown in the Gantry, never on the overlay.':
    'Показывается только в Gantry, на оверлее — никогда.',
  'Replace this layout with the overlay Standings settings':
    'Заменить эту таблицу настройками оверлея «Таблица позиций»',
  'Multiclass Standings': 'Мультиклассовая таблица',
  'Class Header': 'Заголовок класса',
  'Class Name Background': 'Фон названия класса',
  'Show a colored background on the class name badge':
    'Цветной фон у значка названия класса',
  'Class Info Background': 'Фон сведений о классе',
  'Show a colored background on the SOF and driver count badges':
    'Цветной фон у значков SOF и числа пилотов',
  'Bottom Border': 'Нижняя граница',
  'Show a colored bottom border beneath the class header row':
    'Цветная линия под строкой заголовка класса',
  'Compact SoF Formatting': 'Компактный формат SoF',
  'Display SoF as a compact value (e.g. "2.4k" instead of "2432")':
    'Показывать SoF в компактном виде (например, «2.4k» вместо «2432»)',
  'Show Manufacturer Counts': 'Показывать число машин по маркам',
  'Show manufacturer icons with driver counts in the class header (multi-make classes only)':
    'Значки производителей с числом пилотов в заголовке класса (только для классов с несколькими марками)',
  'Max manufacturers to show': 'Сколько марок показывать',
  'Always show your manufacturer': 'Всегда показывать вашу марку',
  'If your manufacturer is outside the cap, it replaces the last shown entry':
    'Если ваша марка не попадает в лимит, она заменяет последнюю показанную',
  'Show Column Headers': 'Показывать заголовки столбцов',
  'Show each enabled column header above its values':
    'Заголовок каждого включённого столбца над его значениями',
  'Minimal Lap Count Badge': 'Упрощённый значок числа кругов',
  'Remove the border from the lap count badge':
    'Убрать рамку у значка числа кругов',
  'Configure the relative timing display settings.':
    'Настройка относительной таблицы.',
  'Relative Time': 'Относительное время',
  'Flag Contour': 'Контур флага',

  // Sector Delta
  'Per-sector timing deltas colored by performance.':
    'Дельты по секторам, окрашенные по результату.',
  'Limit visible sectors': 'Ограничить число видимых секторов',
  'Show only a fixed number of sectors at once. On tracks with more sectors, the widget becomes a sliding carousel centered on your current sector.':
    'Показывать одновременно только заданное число секторов. На трассах, где секторов больше, виджет становится прокручиваемой лентой с текущим сектором по центру.',
  'Max Sectors Shown': 'Макс. число секторов',
  'Number of sector cards visible at once. The current sector is centered in the window.':
    'Сколько карточек секторов видно одновременно. Текущий сектор — по центру.',
  'Color Thresholds': 'Пороги цвета',
  'Customize thresholds': 'Свои пороги',
  'Override the default color thresholds (green: 0.5%, yellow: 1.0%).':
    'Заменить стандартные пороги цвета (зелёный: 0,5%, жёлтый: 1,0%).',
  'Green limit': 'Порог зелёного',
  'Sectors within this % of session best show green.':
    'Секторы в пределах этого % от лучшего в сессии — зелёные.',
  'Yellow limit': 'Порог жёлтого',
  'Sectors within this % of session best show yellow. Above = red.':
    'Секторы в пределах этого % от лучшего в сессии — жёлтые. Выше — красные.',

  // Shift Light and Tachometer (custom shift points)
  "Configure the Shift Light. Hint: enable 'Show RPM Text' to see where the box is.":
    'Настройка индикатора переключения передач. Подсказка: включите «Показывать текст RPM», чтобы увидеть, где находится блок.',
  'Configure the tachometer.': 'Настройка тахометра.',
  'Custom Shift Points': 'Свои точки переключения',
  'Enable Custom Shift Points': 'Включить свои точки переключения',
  'If enabled, custom shift points will be displayed':
    'Если включено, показываются ваши точки переключения',
  'If enabled, custom shift points will be displayed on the tachometer':
    'Если включено, ваши точки переключения показываются на тахометре',
  // "(<n> cars)", after the number
  'cars)': 'маш.)',
  'Demo Mode Car': 'Машина для демо-режима',
  // "Demo mode uses the <BMW M4 GT4> (bmwm4gt4). Configure …"
  'Demo mode uses the': 'В демо-режиме используется',
  '(bmwm4gt4). Configure custom shift points for this car to test in demo mode.':
    '(bmwm4gt4). Настройте точки переключения для этой машины, чтобы проверить их в демо-режиме.',
  'Indicator Type': 'Тип индикатора',
  Pulse: 'Пульсация',
  Border: 'Рамка',
  'Add Car': 'Добавить машину',
  'Select a car...': 'Выберите машину…',
  // After the car id in the car picker
  '(current car)': '(текущая машина)',
  'Configured Cars': 'Настроенные машины',
  // "Redline: <rpm> RPM"
  'Redline:': 'Красная зона:',
  'Show Oil Temperature': 'Показывать температуру масла',
  'Oil Position': 'Положение температуры масла',
  'Oil Edge Offset': 'Отступ температуры масла от края',
  'Show Water Temperature': 'Показывать температуру воды',
  'Water Position': 'Положение температуры воды',
  'Water Edge Offset': 'Отступ температуры воды от края',
  'Swap Oil/Water Sides': 'Поменять местами масло и воду',

  // Telemetry Inspector
  'Debug widget to display raw telemetry and session values. Add properties to watch.':
    'Отладочный виджет для просмотра исходных значений телеметрии и сессии. Добавьте свойства для отслеживания.',
  // "Watched Properties (<n>)"
  'Watched Properties (': 'Отслеживаемые свойства (',
  'No properties configured. Add some below.':
    'Свойства не заданы. Добавьте их ниже.',
  // Source badge of a watched property: Telemetry / Session
  T: 'Т',
  S: 'С',
  'Add Custom Property': 'Добавить своё свойство',
  Telemetry: 'Телеметрия',
  'Property path (e.g., Speed)': 'Путь к свойству (например, Speed)',
  'Label (optional)': 'Подпись (необязательно)',
  'Quick Add - Telemetry': 'Быстрое добавление — телеметрия',
  'Quick Add - Session': 'Быстрое добавление — сессия',
  'Steering Angle': 'Угол руля',
  'Lap Distance': 'Дистанция круга',
  'Lap Distance %': 'Дистанция круга, %',
  'Time Remaining': 'Оставшееся время',
  'Fuel Level %': 'Уровень топлива, %',
  'Fuel Use/Hour': 'Расход топлива в час',
  'Is On Track': 'На трассе',
  'Car Lap Dist %': 'Дистанция круга машин, %',
  'Car On Pit Road': 'Машины на пит-лейне',
  'Car Position': 'Позиции машин',
  'Player Position': 'Ваша позиция',
  'Player Class Position': 'Ваша позиция в классе',
  'Track Temp (Crew)': 'Температура трассы (для команды)',
  'LMU Pit Stop Time': 'Время пит-стопа LMU',
  'LMU Repair Time': 'Время ремонта LMU',
  'LMU Refuel Target': 'Цель заправки LMU',
  'LMU Refuel Is Virtual Energy': 'Заправка виртуальной энергией LMU',
  'LMU State Of Charge': 'Заряд батареи LMU',
  'LMU Regen': 'Рекуперация LMU',
  'LMU Brake Wear': 'Износ тормозов LMU',
  'LMU Suspension Damage': 'Повреждение подвески LMU',
  'LMU Aero Damage': 'Повреждение аэродинамики LMU',
  'Track Length': 'Длина трассы',
  'Team Racing': 'Командная гонка',
  'Num Car Classes': 'Число классов',
  'Event Type': 'Тип события',
  'Driver Car Index': 'Индекс вашей машины',
  'Pit Track %': 'Положение вашего бокса, %',
  'Fuel Capacity (L)': 'Объём бака (л)',
  'LMU Time Scale': 'Масштаб времени LMU',
  'LMU Max Virtual Energy': 'Макс. виртуальная энергия LMU',
  'LMU Private Qualifying': 'Закрытая квалификация LMU',
  'LMU Fuel Ratio (L per % VE)': 'Коэффициент топлива LMU (л на % ВЭ)',
  'LMU Fuel Slider Max (L)': 'Макс. ползунка топлива LMU (л)',

  // Track Map and Flat Track Map
  'Configure track map visualization settings.':
    'Настройка отображения карты трассы.',
  'Configure flat track map visualization settings.':
    'Настройка отображения линейной карты трассы.',
  'Sector Colors': 'Цвета секторов',
  'Enable Turn Labels': 'Включить подписи поворотов',
  'Show turn numbers and names on the track map':
    'Показывать номера и названия поворотов на карте трассы',
  'Use custom icon for player': 'Свой значок для вашей машины',
  'Replace the player circle with a custom image':
    'Заменить ваш кружок своим изображением',
  'Player icon': 'Ваш значок',
  'Click or drag to replace icon':
    'Нажмите или перетащите файл, чтобы заменить значок',
  'or click to select (PNG, JPG, GIF, WebP, SVG)':
    'или нажмите, чтобы выбрать файл (PNG, JPG, GIF, WebP, SVG)',
  'Remove icon?': 'Удалить значок?',
  'Yes, remove': 'Да, удалить',
  'Remove icon': 'Удалить значок',
  'Unsupported format. Please use PNG, JPG, GIF, WebP or SVG.':
    'Неподдерживаемый формат. Используйте PNG, JPG, GIF, WebP или SVG.',
  'Minimal Styling': 'Минималистичное оформление',

  // Weather and Wind
  Wetness: 'Влажность трассы',
  'Track State': 'Состояние трассы',
  'Show weather related readings (air/track temperature, wind, wetness, track state).':
    'Показывает погодные данные (температуру воздуха и трассы, ветер, влажность и состояние трассы).',
  'Show wind direction and speed.': 'Показывает направление и скорость ветра.',

  // Stream Chat
  'Show live Twitch and YouTube chat in one overlay.':
    'Чаты Twitch и YouTube в реальном времени в одном оверлее.',
  'Twitch channel:': 'Канал Twitch:',
  'Name of the Twitch channel to read chat from. Leave empty to turn Twitch chat off.':
    'Название канала Twitch, чат которого нужно читать. Оставьте пустым, чтобы выключить чат Twitch.',
  'Use the channel name only: letters, digits and underscore.':
    'Укажите только название канала: буквы, цифры и подчёркивание.',
  'YouTube channel:': 'Канал YouTube:',
  'Handle of the YouTube channel, starting with @. Chat connects while the channel is live. Leave empty to turn YouTube chat off.':
    'Псевдоним канала YouTube, начиная с @. Чат подключается, пока на канале идёт трансляция. Оставьте пустым, чтобы выключить чат YouTube.',
  'Enter the handle with a leading @, for example @channelname.':
    'Введите псевдоним с @ в начале, например @channelname.',

  // Car Systems
  'Brake bias, ABS, traction control and the other adjustments your car exposes.':
    'Баланс тормозов, ABS, трекшн-контроль и другие регулировки, доступные в вашей машине.',
  Rows: 'Строки',
  'Named differently on some cars, which control the widget follows.':
    'В некоторых машинах называется иначе; виджет показывает соответствующую регулировку.',
  // Adjustment names (src/types/carSystems.ts)
  'Brake Bias Fine': 'Баланс тормозов (точно)',
  'Brake Bias Target': 'Целевой баланс тормозов',
  'Rear Brake Valve': 'Клапан задних тормозов',
  'Traction Control': 'Трекшн-контроль',
  'Traction Control 2': 'Трекшн-контроль 2',
  'Throttle Shape': 'Характеристика газа',
  'Engine Power': 'Мощность двигателя',
  'Engine Braking': 'Торможение двигателем',
  'Power Steering Assist': 'Усилитель руля',
  'Fuel Mixture': 'Топливная смесь',
  'ARB Front': 'Передний стабилизатор',
  'ARB Rear': 'Задний стабилизатор',
  'Diff Entry': 'Дифференциал: вход',
  'Diff Mid': 'Дифференциал: середина',
  'Diff High Speed': 'Дифференциал: высокая скорость',
  'Deploy Level': 'Уровень отдачи энергии',
  'Regen Level': 'Уровень рекуперации',
  'Deploy Mode': 'Режим отдачи энергии',
  'Weight Jacker': 'Регулятор развесовки',

  // Small widget pages
  'Displays the current track section name, corner number, and progress through the section. Track data sourced from lovely-track-data.':
    'Показывает название текущего участка трассы, номер поворота и прогресс по участку. Данные о трассах — из lovely-track-data.',
  Elements: 'Элементы',
  'Live speed difference against your session best clean lap at this point on track.':
    'Разница скорости в реальном времени с вашим лучшим чистым кругом сессии в этой точке трассы.',
  Units: 'Единицы',
  "Unit for the numeric readout. Auto follows iRacing's own display units setting.":
    'Единицы для числового значения. «Авто» следует настройке единиц в iRacing.',
  'Configure settings for the faster cars detection widget.':
    'Настройки виджета обнаружения более быстрых машин.',
  'Distance Threshold': 'Порог расстояния',
  'Minimum gap to a faster car before it is displayed. Smaller values show cars that are closer behind you.':
    'Минимальный разрыв до более быстрой машины, при котором она показывается. Чем меньше значение, тем ближе к вам показываемые машины.',
  'Display track flags': 'Показывает флаги на трассе',
  'Display indicator for slow cars ahead':
    'Показывает индикатор медленных машин впереди',
  "Configure settings for the Rejoin Indicator. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road.":
    'Настройки индикатора возврата на трассу. Примечание: виджет автоматически скрывается, когда вы в гараже, в боксе или на пит-лейне.',
  'Assists with pit entry by showing speed delta, pitbox position, and warnings.':
    'Помогает при заезде на пит-лейн: показывает дельту скорости, положение пит-бокса и предупреждения.',
  Calibration: 'Калибровка',
  'Show when approaching pit': 'Показывать при подъезде к пит-лейну',
  'Display overlay before entering pit lane':
    'Показывать оверлей до въезда на пит-лейн',
  Warnings: 'Предупреждения',
  'Pit Exit Inputs': 'Педали на выезде',
  'Show Throttle': 'Показывать газ',
  'Show Clutch': 'Показывать сцепление',
} satisfies Record<string, string>;
