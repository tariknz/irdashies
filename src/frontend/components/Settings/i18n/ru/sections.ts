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
} satisfies Record<string, string>;
