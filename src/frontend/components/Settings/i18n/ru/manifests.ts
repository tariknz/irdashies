export default {
  // battle
  'Full (1:23.456)': 'Полный (1:23.456)',
  'Mixed (1:23.4)': 'Сокращённый (1:23.4)',
  'Minutes (1:23)': 'Минуты (1:23)',
  'Seconds full (83.456)': 'Секунды, полный (83.456)',
  'Seconds mixed (83.4)': 'Секунды, сокращённый (83.4)',
  'Seconds (83)': 'Секунды (83)',
  '1 (0.0s)': '1 (0.0 с)',
  '2 (0.00s)': '2 (0.00 с)',
  '3 (0.000s)': '3 (0.000 с)',
  // blindspotmonitor
  'Visual style of the blind spot indicator.':
    'Внешний вид индикатора слепой зоны.',
  'Width of the blind spot indicator in pixels.':
    'Ширина индикатора слепой зоны в пикселях.',
  'Border Size': 'Толщина рамки',
  'Border thickness of the blind spot indicator in pixels.':
    'Толщина рамки индикатора слепой зоны в пикселях.',
  'Square Size': 'Размер квадрата',
  'Width and height of the indicator square in pixels.':
    'Ширина и высота квадрата индикатора в пикселях.',
  'Vertical Position': 'Положение по вертикали',
  'Vertical placement within the widget. 0% = top, 50% = centre, 100% = bottom.':
    'Положение по вертикали внутри виджета. 0% — верх, 50% — центр, 100% — низ.',
  'Show Count': 'Показывать число машин',
  'Display the number of cars inside the indicator square.':
    'Показывать число машин внутри квадрата индикатора.',
  'Colour by Car Count': 'Цвет по числу машин',
  'Use different colours based on how many cars are in your blind spot.':
    'Менять цвет в зависимости от того, сколько машин в слепой зоне.',
  'Distance to car ahead in meters.': 'Расстояние до машины впереди в метрах.',
  'Distance to car behind in meters.': 'Расстояние до машины сзади в метрах.',
  'If enabled, blind spotter will only be shown when driving':
    'Если включено, контроль слепых зон показывается только во время езды',
  // carsystems
  'Keep rows the car does not have': 'Оставлять строки, которых нет у машины',
  'Shows a blank row so each adjustment keeps the same position between cars. Turn off to show only what the current car exposes.':
    'Показывает пустую строку, чтобы каждая настройка оставалась на своём месте при смене машины. Выключите, чтобы видеть только то, что есть у текущей машины.',
  'Keep rows switched off': 'Оставлять выключенные системы',
  'Shows a system the driver has turned off, greyed and reading zero. Turn off to leave only the systems actually in use.':
    'Показывает систему, которую пилот выключил, серым цветом и с нулевым значением. Выключите, чтобы оставить только реально используемые системы.',
  // cornername
  'Show Corner Number': 'Показывать номер поворота',
  'Display the corner number badge (e.g. T1, T3)':
    'Показывать значок с номером поворота (например, T1, T3)',
  'Display progress through the current section':
    'Показывать прохождение текущего участка',
  'Show Track Percentage': 'Показывать процент трассы',
  'Display overall track position percentage':
    'Показывать положение на трассе в процентах от длины круга',
  'Base font size for corner names (px)':
    'Базовый размер шрифта названий поворотов (px)',
  // deltaspeed
  'Full Colour At (km/h)': 'Полный цвет при (км/ч)',
  'Delta at which the background reaches full colour. Lower values make small differences more visible.':
    'Дельта, при которой фон достигает полного цвета. Меньшие значения делают небольшие различия заметнее.',
  'Full Colour At (mph)': 'Полный цвет при (миль/ч)',
  'The same limit used when displaying mph, kept separate so both stay whole numbers.':
    'Тот же предел для отображения в милях в час; задаётся отдельно, чтобы оба значения оставались целыми.',
  'Maximum Shown (km/h)': 'Максимум на экране (км/ч)',
  'Largest delta shown as a number. Beyond this the readout holds at the limit instead of climbing.':
    'Наибольшая дельта, отображаемая числом. Выше неё показание останавливается на пределе, а не растёт дальше.',
  'Maximum Shown (mph)': 'Максимум на экране (миль/ч)',
  'Update Threshold (km/h)': 'Порог обновления (км/ч)',
  'The number holds still until the delta has moved at least this far. Higher values stop the last digit flickering.':
    'Число не меняется, пока дельта не сдвинется хотя бы на эту величину. Большие значения убирают мерцание последней цифры.',
  'Update Threshold (mph)': 'Порог обновления (миль/ч)',
  'The same threshold used when displaying mph.':
    'Тот же порог для отображения в милях в час.',
  'Show number': 'Показывать число',
  'Show the numeric delta inside the box.':
    'Показывать дельту числом внутри блока.',
  // fastercarsfrombehind
  'Show Distance': 'Показывать расстояние',
  'Display the distance to the faster car.':
    'Показывать расстояние до более быстрой машины.',
  'Show Name': 'Показывать имя',
  'Display the driver name in the faster cars widget.':
    'Показывать имя пилота в виджете быстрых машин.',
  'Remove numbers from the displayed driver name.':
    'Убирать цифры из отображаемого имени пилота.',
  'Show Driver Badge': 'Показывать значок пилота',
  'Display the driver license and iRating badge.':
    'Показывать значок с лицензией и iRating пилота.',
  'Drivers Behind': 'Пилотов сзади',
  'Align Driver Boxes': 'Выравнивание блоков пилотов',
  'Align to Top of Widget': 'По верху виджета',
  'Align to Bottom of Widget': 'По низу виджета',
  'Closest Driver': 'Ближайший пилот',
  'Closest Driver at Top': 'Ближайший сверху',
  'Closest Driver at Bottom': 'Ближайший снизу',
  'Only show faster classes': 'Показывать только более быстрые классы',
  'If enabled, only cars from faster classes will be shown. Same-class competitors will be hidden.':
    'Если включено, показываются только машины более быстрых классов. Соперники из того же класса скрываются.',
  'If enabled, faster cars will only be shown when driving':
    'Если включено, быстрые машины показываются только во время езды',
  // flag
  'Double Flag': 'Двойной флаг',
  'When enabled two flags will be displayed':
    'Если включено, отображаются два флага',
  'Matrix Mode': 'Режим матрицы',
  'Choose between 8x8, 16x16, or uniform color rendering.':
    'Выберите матрицу 8x8, 16x16 или однотонную заливку.',
  'Uniform (1x1)': 'Однотонный (1x1)',
  'Animate Flag': 'Анимировать флаг',
  'When enabled the flag will blink on/off': 'Если включено, флаг мигает',
  'Blink Period (s)': 'Период мигания (с)',
  'Set how many seconds between on/off when animation is enabled. Min 0.1s, Max 3s.':
    'Сколько секунд между включением и выключением при анимации. Минимум 0,1 с, максимум 3 с.',
  'Show Flag Label': 'Показывать название флага',
  'Toggle display of the flag name text': 'Показывать текстовое название флага',
  'Show No Flag State': 'Показывать состояние без флага',
  "Display 'no flag' (grey leds) when no flags are waved":
    'Показывать «нет флага» (серые светодиоды), когда флагов нет',
  'Enable Glow Effect': 'Включить свечение',
  'Add a glow effect around the matrix lights':
    'Добавить свечение вокруг огней матрицы',
  'If enabled, flags will only be shown when driving':
    'Если включено, флаги показываются только во время езды',
  // flatmap
  'Track Line Width': 'Ширина линии трассы',
  'Thickness of the track line (matches curved track map scale)':
    'Толщина линии трассы (в масштабе обычной карты трассы)',
  'Track Outline Width': 'Ширина обводки трассы',
  'Thickness of the outline around the track': 'Толщина обводки вокруг трассы',
  'Invert Track Colors': 'Инвертировать цвета трассы',
  'Swap black and white colors for the track':
    'Поменять местами чёрный и белый цвета трассы',
  'Show Car Numbers': 'Показывать номера машин',
  'Display car numbers on driver circles':
    'Показывать номера машин в кружках пилотов',
  'Session Position': 'Позиция в сессии',
  'Live Position': 'Текущая позиция',
  'Driver Circle Size': 'Размер кружка пилота',
  'Size of the circle for other drivers (matches curved track map scale)':
    'Размер кружка других пилотов (в масштабе обычной карты трассы)',
  'Player Circle Size': 'Размер вашего кружка',
  'Size of the circle for your car (matches curved track map scale)':
    'Размер кружка вашей машины (в масштабе обычной карты трассы)',
  'Relative Font Size': 'Относительный размер шрифта',
  'Relative size of the font within the trackmap':
    'Относительный размер шрифта на карте трассы',
  'Use Highlight Color for Player':
    'Использовать цвет выделения для своей машины',
  'Use your custom highlight color for the player car instead of class color':
    'Окрашивать вашу машину в выбранный цвет выделения вместо цвета класса',
  'Use Inverted Color for the Leader':
    'Использовать инвертированный цвет для лидера',
  'Use an alternate color for the leader car instead of class color':
    'Выделять машину лидера другим цветом вместо цвета класса',
  'If enabled, track map will only be shown when driving':
    'Если включено, карта трассы показывается только во время езды',
  // fuel
  'Use General Compact Mode': 'Использовать общий компактный режим',
  'Syncs with Compact Mode in General tab':
    'Синхронизируется с компактным режимом на вкладке «Общие»',
  'Use General font Sizes': 'Использовать общие размеры шрифта',
  'Syncs with Font Size slider in General tab':
    'Синхронизируется с ползунком размера шрифта на вкладке «Общие»',
  'Fuel Units': 'Единицы топлива',
  'Show fuel in litres or gallons.':
    'Показывать топливо в литрах или галлонах.',
  'Litres (L)': 'Литры (л)',
  'Gallons (gal)': 'Галлоны (гал)',
  'Safety Margin': 'Запас топлива',
  'Extra fuel added to "To Finish" calculation.':
    'Дополнительное топливо, добавляемое к расчёту «To Finish».',
  'If enabled, fuel will only be shown when driving':
    'Если включено, расчёт топлива показывается только во время езды',
  'Show Border Color': 'Показывать цветную рамку',
  'Green (safe), Orange (caution), Red (danger)':
    'Зелёный (норма), оранжевый (внимание), красный (опасность)',
  'Enable Historical Persistence': 'Сохранять историю',
  'Saves the last 10 laps for each car/track to provide immediate estimates.':
    'Сохраняет последние 10 кругов для каждой пары машина/трасса, чтобы сразу давать оценки.',
  'Enable Debug Logging': 'Вести отладочный журнал',
  'Log comprehensive data to file for troubleshooting.':
    'Записывать подробные данные в файл для поиска неисправностей.',
  'Fixed Target Lap': 'Фиксированный целевой круг',
  'Enable a specific lap target for strategy':
    'Задать конкретный целевой круг для стратегии',
  'Laps Shown': 'Число кругов',
  'Number of recent completed laps to show (1–50).':
    'Сколько последних завершённых кругов показывать (1–50).',
  'Line Chart': 'Линейный график',
  Histogram: 'Гистограмма',
  // gantry
  'Keep on top of other windows': 'Держать поверх других окон',
  'The Gantry stays visible above iRacing and other apps. iRacing must run in borderless or windowed mode. Exclusive fullscreen hides every window, including this one.':
    'Gantry остаётся видимым поверх iRacing и других приложений. iRacing должен работать в оконном режиме или в окне без рамки. Эксклюзивный полноэкранный режим скрывает все окна, включая это.',
  // infobar
  'Hide the widget when you are not in the car':
    'Скрывать виджет, когда вы не в машине',
  // input
  'Use Raw Inputs': 'Использовать необработанный ввод',
  "Disables iRacing's automated input processing, showing direct pedal telemetry without assists like auto-clutch or anti-stall.":
    'Отключает автоматическую обработку ввода в iRacing и показывает прямую телеметрию педалей без помощников вроде автосцепления или защиты от заглохания.',
  'Show Clutch Trace': 'Показывать график сцепления',
  'Show Throttle Trace': 'Показывать график газа',
  'Show Brake Trace': 'Показывать график тормоза',
  'Show ABS': 'Показывать ABS',
  'Show Steering Trace': 'Показывать график руля',
  'Stroke Width': 'Толщина линии',
  'Max Samples': 'Макс. отсчётов',
  samples: 'отсчётов',
  'Show Clutch Bar': 'Показывать шкалу сцепления',
  'Show Throttle Bar': 'Показывать шкалу газа',
  'Show Brake Bar': 'Показывать шкалу тормоза',
  'Show ABS Indicator': 'Показывать индикатор ABS',
  'Wheel Style': 'Вид руля',
  Formula: 'Формула',
  'U-Shape': 'U-образный',
  'Ring (gear inside)': 'Кольцо (передача внутри)',
  'Wheel Color': 'Цвет руля',
  'Gear Display Scale': 'Масштаб индикатора передачи',
  'Relative size of the gear number display':
    'Относительный размер номера передачи',
  'Show the current speed beneath the gear number':
    'Показывать текущую скорость под номером передачи',
  'Show Speed Unit Label': 'Показывать единицы скорости',
  'Swap Speed & Unit': 'Поменять местами скорость и единицы',
  'If enabled, inputs will only be shown when driving':
    'Если включено, педали и руль показываются только во время езды',
  // laptimelog
  'Show Current Lap': 'Показывать текущий круг',
  'Display the live lap time for the current lap.':
    'Показывать время текущего круга в реальном времени.',
  'Show Predicted Lap': 'Показывать прогноз круга',
  'Show the current predicted lap based on the current delta time.':
    'Показывать прогнозируемое время круга по текущей дельте.',
  'Show Last Lap': 'Показывать последний круг',
  "Show the driver's last lap time.":
    'Показывать время последнего круга пилота.',
  'Show Session Best Lap': 'Показывать лучший круг сессии',
  "Show the driver's best lap time this session.":
    'Показывать лучшее время круга пилота в этой сессии.',
  'Show Personal Best Lap': 'Показывать личный рекорд',
  'Shows the best lap time ever recorded by irDashies for the car and track combo.':
    'Показывает лучшее время круга, когда-либо записанное irDashies для этой машины на этой трассе.',
  'Display Lap Delta': 'Показывать дельту круга',
  "Choose which lap to base the delta calculation on. This can be the driver's last lap, best lap, or the overall session best lap.":
    'Выберите, относительно какого круга считать дельту: последнего круга пилота, его лучшего круга или лучшего круга сессии.',
  'Delta Calculation Base Lap': 'Базовый круг для дельты',
  'Show Lap History': 'Показывать историю кругов',
  "Show the driver's lap history. You can configure how many to show below.":
    'Показывать историю кругов пилота. Сколько кругов показывать, настраивается ниже.',
  'History Style': 'Вид истории',
  'Number Of Laps To Show': 'Сколько кругов показывать',
  'Hide Pitted Laps': 'Скрывать круги с пит-стопом',
  'Leave out laps where you pitted. They are much slower than a green lap, so they stretch the chart and pull the average away from your real pace.':
    'Не учитывать круги, на которых вы заезжали на пит-стоп. Они намного медленнее круга под зелёным флагом, растягивают график и уводят среднее от вашего реального темпа.',
  'Foreground Opacity': 'Непрозрачность переднего плана',
  'Text Scale': 'Масштаб текста',
  "Adjust the size of the font by adjusting this widget's scale":
    'Размер шрифта меняется через масштаб этого виджета',
  'Reverse Order': 'Обратный порядок',
  'Display the lap time elements in reverse order':
    'Показывать элементы времени круга в обратном порядке',
  'Widget Alignment': 'Выравнивание виджета',
  'If enabled, lap times will only be shown when driving':
    'Если включено, время кругов показывается только во время езды',
  // laptrace
  'Reference Source': 'Источник эталона',
  'Which saved lap to plot. Your personal best is recorded automatically from your first clean lap on each track and car.':
    'Какой сохранённый круг отображать. Ваш личный рекорд записывается автоматически с первого чистого круга на каждой трассе и машине.',
  'My best lap': 'Мой лучший круг',
  'Imported .ibt lap': 'Импортированный круг .ibt',
  'Garage 61 (imported lap)': 'Garage 61 (импортированный круг)',
  'How much track ahead of the car is visible. Set this and Distance Behind unevenly to see further in one direction than the other.':
    'Какой участок трассы впереди машины виден. Задайте его и «Расстояние сзади» по-разному, чтобы видеть дальше в одну сторону, чем в другую.',
  'Plot the throttle trace': 'Строить график газа',
  'Plot the brake trace': 'Строить график тормоза',
  "Plot speed, scaled to the reference lap's own range":
    'Строить график скорости в масштабе диапазона эталонного круга',
  'Gear Labels': 'Номера передач',
  'Show the gear number at each shift point in the reference lap':
    'Показывать номер передачи в каждой точке переключения на эталонном круге',
  'Brake Points': 'Точки торможения',
  "A dotted vertical line through the plot at the exact point the reference (and, while you're driving, your own lap) applied and released the brake. Interpolated between telemetry samples, so it's accurate to well under a metre — finer than the trace itself can be.":
    'Пунктирная вертикальная линия через график в точке, где на эталонном круге (а пока вы едете — и на вашем) нажали и отпустили тормоз. Положение интерполируется между отсчётами телеметрии, поэтому точность намного лучше метра — точнее, чем может быть сам график.',
  'Throttle Points': 'Точки газа',
  'A dotted vertical line through the plot at the exact point the reference got back on the throttle.':
    'Пунктирная вертикальная линия через график в точке, где на эталонном круге снова открыли газ.',
  'Input Trace': 'График педалей и руля',
  'Overlay the lap you are driving now, bright, on the same axes':
    'Накладывать текущий круг ярким цветом на те же оси',
  'Colour your brake trace where ABS took over, the same yellow the Input widget uses':
    'Окрашивать ваш график тормоза там, где срабатывала ABS, тем же жёлтым, что и в виджете «Педали и руль»',
  'ABS Style': 'Вид ABS',
  "'Bar' fills your brake trace down to the axis where ABS engaged, the same as the Input Trace widget, and blends colour with a filled reference trace it overlaps. 'Overlay' just colours the line.":
    '«Полоса» заливает ваш график тормоза до оси там, где сработала ABS, как в виджете «Графики педалей и руля», и смешивает цвет с залитым эталонным графиком, который она перекрывает. «Оверлей» только окрашивает линию.',
  'Bar (fill under curve)': 'Полоса (заливка под кривой)',
  'ABS Strip': 'Полоса ABS',
  'Also mark where ABS engaged as a bar beneath the traces, easier to spot than the trace colour alone':
    'Также отмечать срабатывание ABS полосой под графиками — её проще заметить, чем один только цвет графика',
  'Fill Reference Under Curve': 'Заливать эталон под кривой',
  'Draw the reference throttle and brake as filled bars down to the axis instead of a line':
    'Рисовать эталонные газ и тормоз залитыми полосами до оси вместо линии',
  'Last Corner Panel': 'Панель последних поворотов',
  'Shows how the corners you just finished compared with the reference lap. Each result appears as you exit the corner and stays while the next few are driven, so a sequence of corners is still readable afterwards. The corner you are in holds an empty slot until you exit it. Needs the bundled track data for the circuit.':
    'Показывает, как только что пройденные повороты соотносятся с эталонным кругом. Каждый результат появляется на выходе из поворота и остаётся, пока проходятся следующие несколько, так что серию поворотов можно прочитать и после неё. Для поворота, в котором вы находитесь, слот остаётся пустым до выхода из него. Требуются встроенные данные об этой трассе.',
  'Corner Label': 'Подпись поворота',
  "Name uses the track's own corner names and wraps a long one over two lines. Turn number shows T1, T2 and so on instead, which keeps the rows compact; where a complex is split into several sections both styles letter them A, B, C.":
    '«Название» берёт собственные названия поворотов трассы и переносит длинное на две строки. «Номер поворота» показывает T1, T2 и так далее, что делает строки компактнее; если комплекс разбит на несколько участков, оба стиля обозначают их буквами A, B, C.',
  Name: 'Название',
  'Turn number': 'Номер поворота',
  'Min Speed Unit': 'Единицы мин. скорости',
  'Auto (follow iRacing)': 'Авто (как в iRacing)',
  'Panel Position': 'Положение панели',
  'Which edge of the graph the panel sits on. Left and right stack the corners in a column and take width from the trace, so they suit a wider widget.':
    'К какому краю графика прикреплена панель. Слева и справа повороты выстраиваются в столбец и забирают ширину у графика, поэтому эти варианты подходят для более широкого виджета.',
  'Corners Shown': 'Число поворотов',
  'How many recent corners stay on screen. Through esses and chicanes the next corner often starts within a second, so more than one keeps a sequence readable.':
    'Сколько последних поворотов остаётся на экране. В связках и шиканах следующий поворот часто начинается меньше чем через секунду, поэтому несколько поворотов на экране помогают читать серию.',
  'Countdown Bar(s)': 'Полосы отсчёта',
  "Display bar(s) that drain before your reference lap braked. Turning red at the brake point itself. Follows the reference lap's brake points; light dabs of the brake are ignored.":
    'Показывать полосы, которые убывают перед точкой торможения эталонного круга и становятся красными в самой точке торможения. Следуют точкам торможения эталонного круга; лёгкие касания тормоза игнорируются.',
  'Final Bar': 'Последняя полоса',
  'Which end the last bar sits at — the one that turns red at the brake point. The strip drains towards it.':
    'С какого края стоит последняя полоса — та, что краснеет в точке торможения. Полосы убывают в её сторону.',
  'Countdown Sound': 'Звуковой отсчёт',
  'Three beeps at 3, 2 and 1 second, then a distinct tone at the brake point.':
    'Три сигнала за 3, 2 и 1 секунду, затем отдельный тон в точке торможения.',
  'Brake point cue lead': 'Упреждение сигнала торможения',
  'Adjusts how many seconds before the braking point the audio alert will trigger. It can be used to compensate for driver reaction time.':
    'За сколько секунд до точки торможения срабатывает звуковой сигнал. Помогает учесть время реакции пилота.',
  'Line Thickness': 'Толщина линии',
  'Stroke width of the reference traces': 'Толщина линий эталонных графиков',
  'Last Corner Text Size': 'Размер текста последних поворотов',
  'Size of the corner time and apex speed readout':
    'Размер показаний времени поворота и скорости в апексе',
  'Latest Corner Size': 'Размер последнего поворота',
  'How much bigger the corner you just finished is drawn relative to the older ones behind it':
    'Насколько крупнее рисуется только что пройденный поворот по сравнению с предыдущими',
  // map
  Numbers: 'Номера',
  Names: 'Имена',
  Both: 'Оба',
  'High Contrast Labels': 'Контрастные подписи',
  'Use black background for turn numbers and turn names for better legibility':
    'Чёрный фон под номерами и названиями поворотов для лучшей читаемости',
  'Relative Label Size': 'Относительный размер подписей',
  'Relative font size of the turn labels':
    'Относительный размер шрифта подписей поворотов',
  'Size of the circle or custom icon for your car':
    'Размер кружка или своего значка вашей машины',
  'Minimal Track': 'Минималистичная трасса',
  'Remove the drop shadow from the track': 'Убрать тень у трассы',
  'Minimal Car Markers': 'Минималистичные метки машин',
  'Remove the drop shadow from the car markers': 'Убрать тень у меток машин',
  // pitlanehelper
  'Approach Distance': 'Расстояние подъезда',
  'Show Speed Summary': 'Показывать сводку скорости',
  'Show summary of speed delta, speed unit and speed limit':
    'Показывать сводку: дельту скорости, единицы и ограничение скорости',
  'Show Speed Delta': 'Показывать дельту скорости',
  'Show speed delta plus/minus the speed limit':
    'Показывать, насколько скорость выше или ниже ограничения',
  'Speed Limit Style': 'Вид ограничения скорости',
  European: 'Европейский',
  American: 'Американский',
  'Speed Bar': 'Шкала скорости',
  'Show bar indicating speed relative to pit limit':
    'Показывать шкалу скорости относительно ограничения на пит-лейне',
  'Speed Bar Orientation': 'Ориентация шкалы скорости',
  'Progress Bar': 'Шкала прогресса',
  'Show bar indicating distance to pit box':
    'Показывать шкалу расстояния до пит-бокса',
  'Progress Bar Orientation': 'Ориентация шкалы прогресса',
  'Show Past Box': 'Показывать после бокса',
  'Show bar indicating distance past the pit box':
    'Показывать шкалу расстояния, пройденного после пит-бокса',
  'Pit Limiter Warning': 'Предупреждение о лимитере',
  'Flash warning if entering pit without limiter':
    'Мигающее предупреждение при въезде на пит-лейн без лимитера',
  'Show Pitlane Traffic': 'Показывать трафик на пит-лейне',
  'Display count of cars ahead/behind in pitlane':
    'Показывать число машин впереди и сзади на пит-лейне',
  'Early Pitbox Warning': 'Предупреждение о близком боксе',
  'Alert when pitbox is near pit entry':
    'Предупреждать, если пит-бокс находится близко к въезду на пит-лейн',
  'Early Warning Threshold': 'Порог раннего предупреждения',
  'Distance from pitbox to trigger warning (meters)':
    'Расстояние от пит-бокса, при котором срабатывает предупреждение (в метрах)',
  'Show Pit Exit Inputs': 'Показывать педали на выезде',
  'Display throttle/clutch bars for pit exit':
    'Показывать шкалы газа и сцепления для выезда с пит-лейна',
  'When to Show': 'Когда показывать',
  'At Pitbox': 'В боксе',
  'After Pitbox': 'После бокса',
  'Always (on pit road)': 'Всегда (на пит-лейне)',
  // radar
  'Fade Time': 'Время затухания',
  'Only When on Track': 'Только на трассе',
  'Hide the radar while you are not driving.':
    'Скрывать радар, пока вы не едете.',
  'Hide in Pit Box': 'Скрывать в пит-боксе',
  'Keep the radar off screen while your car is parked in its pit box.':
    'Не показывать радар, пока ваша машина стоит в пит-боксе.',
  'Hide Cars Across the Pit Wall': 'Скрывать машины за стеной пит-лейна',
  'On track, hide cars on pit road; on pit road, hide cars on track.':
    'На трассе скрывать машины на пит-лейне; на пит-лейне скрывать машины на трассе.',
  Range: 'Дальность',
  'Metres from your car to the edge of the radar.':
    'Расстояние в метрах от вашей машины до края радара.',
  'Show Road': 'Показывать дорогу',
  'Draw the track under the cars, turning with your car.':
    'Рисовать трассу под машинами; она поворачивается вместе с вашей машиной.',
  'Road Opacity': 'Непрозрачность дороги',
  'Road Width': 'Ширина дороги',
  'The track drawings carry no width, so pick one that looks right.':
    'В данных трассы нет ширины, поэтому выберите ту, что выглядит правильно.',
  'Car Numbers': 'Номера машин',
  'Edge Fade': 'Затухание к краю',
  'How much of the radar fades out towards the edge, so cars ease in and out. 0% for a hard edge.':
    'Какая часть радара плавно гаснет к краю, чтобы машины появлялись и исчезали мягко. 0% — резкий край.',
  'Distance Rings': 'Кольца расстояния',
  'Ring Spacing': 'Шаг колец',
  Crosshair: 'Перекрестье',
  'Dashed lines through your car, ahead/behind and left/right.':
    'Пунктирные линии через вашу машину: вперёд-назад и влево-вправо.',
  'Moving Centre Line': 'Движущаяся осевая',
  'The dashes of the line ahead run past at your speed, like road markings.':
    'Штрихи линии впереди бегут с вашей скоростью, как дорожная разметка.',
  'Dash Length': 'Длина штриха',
  'Each gap is twice as long as a dash.':
    'Каждый промежуток вдвое длиннее штриха.',
  'Dash Speed': 'Скорость штрихов',
  'Share of your own speed. Lower it if fast dashes flicker.':
    'Доля вашей собственной скорости. Уменьшите, если быстрые штрихи мерцают.',
  'Of every arc, as a share of the radar radius.':
    'Каждой дуги, в долях радиуса радара.',
  'Close Within': 'Порог близости',
  'Bumper-to-bumper gap at which a car turns amber.':
    'Зазор от бампера до бампера, при котором машина становится янтарной.',
  'Gap Distance': 'Величина зазора',
  'Write the bumper-to-bumper gap next to an amber car.':
    'Писать зазор от бампера до бампера рядом с янтарной машиной.',
  'Pulse Rate': 'Частота пульсации',
  'How fast a car alongside pulses. 0 keeps it steady.':
    'Как быстро пульсирует машина рядом с вами. 0 — без пульсации.',
  Hz: 'Гц',
  'Overlap in Per Cent': 'Перекрытие в процентах',
  'Write the overlap next to the strip.': 'Писать перекрытие рядом с полосой.',
  'Closing Faster Than': 'Сближение быстрее',
  'Cars closing slower than this are left alone.':
    'Машины, сближающиеся медленнее, не учитываются.',
  'Seconds to Your Side': 'Секунд до борта',
  'Turns red when the car will be beside you within this time and you are braking, or it has already pulled out. Amber starts at twice this.':
    'Становится красной, если машина окажется рядом с вами в пределах этого времени, а вы тормозите, или если она уже вышла для обгона. Янтарный цвет начинается с удвоенного значения.',
  'Show Where It Will Be': 'Показывать, где она будет',
  'A dashed outline of the diving car 0.8 s ahead, with an arrow to it.':
    'Пунктирный контур атакующей машины на 0,8 с вперёд со стрелкой к нему.',
  'Show Closing Speed': 'Показывать скорость сближения',
  'Write how much faster the car is in km/h, and the seconds until it is beside you.':
    'Писать, на сколько км/ч машина быстрее и через сколько секунд она окажется рядом.',
  'Warn From': 'Предупреждать за',
  'How far ahead a hazard is shown.':
    'На каком расстоянии впереди показывается опасность.',
  'Flash Closer Than': 'Мигать ближе чем',
  'A crashed or slow car flashes from this close. A car coming back on flashes at any distance; one sitting off the track never does.':
    'Разбитая или медленная машина мигает с этого расстояния. Машина, возвращающаяся на трассу, мигает на любом расстоянии; стоящая за пределами трассы — никогда.',
  'Crashed and Stopped Cars': 'Разбитые и стоящие машины',
  'A car that dropped from racing speed in a moment, or stands still. Red.':
    'Машина, мгновенно потерявшая гоночную скорость или стоящая на месте. Красный.',
  'Slow Cars': 'Медленные машины',
  'A car under 60% of your speed that you are closing on fast, and that is crawling or still losing speed. A car steady at corner pace does not count. Amber.':
    'Машина медленнее 60% вашей скорости, к которой вы быстро приближаетесь и которая ползёт или продолжает терять скорость. Машина, стабильно идущая в темпе поворота, не считается. Янтарный.',
  'Off Track and Rejoining': 'Вылет и возврат на трассу',
  'A car off the track for more than half a second, then while it gets back up to speed. Yellow.':
    'Машина, которая дольше полсекунды находится за пределами трассы, а затем — пока снова набирает скорость. Жёлтый.',
  'Show What Happened': 'Показывать, что случилось',
  'Write CRASH, SLOW, OFF or REJOIN before the distance on the rim.':
    'Писать CRASH, SLOW, OFF или REJOIN перед расстоянием на краю радара.',
  'Show Its Speed': 'Показывать её скорость',
  'Write the hazard car speed in km/h under the distance.':
    'Писать скорость опасной машины в км/ч под расстоянием.',
  'Size Cars by Class': 'Размер машин по классу',
  'Draw prototypes, stock cars and formula cars at their own typical size instead of the default. Sizes also decide when a car counts as alongside or close.':
    'Рисовать прототипы, стоковые и формульные машины в их типичном размере, а не в размере по умолчанию. Размеры также определяют, когда машина считается рядом или близко.',
  'Default Car Length': 'Длина машины по умолчанию',
  'iRacing does not report car sizes. Used for classes the radar does not recognise.':
    'iRacing не сообщает размеры машин. Используется для классов, которые радар не распознаёт.',
  'Default Car Width': 'Ширина машины по умолчанию',
  // rejoin
  'Show At Speed': 'Показывать при скорости до',
  'Display the rejoin indicator widget when you are at or below this speed':
    'Показывать индикатор возврата, когда ваша скорость не выше этой',
  'Care Gap': 'Зазор осторожности',
  'Distance to the car behind where you need to be cautious when rejoining. Note: the clear status will show when next car is above this gap':
    'Расстояние до машины сзади, при котором возвращаться на трассу нужно осторожно. Примечание: статус «Clear» показывается, когда следующая машина дальше этого расстояния',
  'Stop Gap': 'Зазор остановки',
  'Distance to the car behind where it is not safe to rejoin':
    'Расстояние до машины сзади, при котором возвращаться на трассу небезопасно',
  // relative
  'Drivers to show around player': 'Пилотов вокруг вас',
  'Use Live Position Standings': 'Использовать позиции в реальном времени',
  'If enabled, live telemetry will be used to compute driver positions. This may be less stable but will update live and not only on start/finish line.':
    'Если включено, позиции пилотов вычисляются по живой телеметрии. Это может быть менее стабильно, но позиции обновляются постоянно, а не только на линии старта/финиша.',
  'Radio Icon Duration': 'Длительность значка радио',
  'How long the speaker icon keeps showing after a driver stops talking. Set to 0 to only show it while they are actively transmitting.':
    'Сколько значок динамика остаётся на экране после того, как пилот перестал говорить. Установите 0, чтобы показывать его только во время передачи.',
  'Show Title Bar': 'Показывать заголовок',
  'Number of decimal places to display':
    'Сколько знаков после запятой показывать',
  'Show Header Bar': 'Показывать верхнюю панель',
  'Show Footer Bar': 'Показывать нижнюю панель',
  'Position Background': 'Фон позиции',
  "Highlight the player's position cell with a colored background":
    'Выделять ячейку вашей позиции цветным фоном',
  'Number Background': 'Фон номера',
  'Show a colored background on the car number cell':
    'Показывать цветной фон в ячейке номера машины',
  'Number Left Border': 'Полоса слева от номера',
  'Show a colored left border on the car number cell':
    'Показывать цветную полосу слева в ячейке номера машины',
  'Minimal License Badge': 'Упрощённый значок лицензии',
  'Use desaturated colors for the iRating/license badge':
    'Приглушённые цвета для значка iRating и лицензии',
  'Minimal Status Badges': 'Упрощённые значки статуса',
  'Use muted borders for PIT, OUT, DNF and other status badges':
    'Приглушённые рамки для значков PIT, OUT, DNF и других статусов',
  'Show Flag Contour': 'Показывать контур флага',
  'Draw a colored border around the widget when a session flag is active':
    'Цветная рамка вокруг виджета, когда в сессии показан флаг',
  'Border Width': 'Ширина рамки',
  'Width of the flag contour border in pixels':
    'Ширина рамки контура флага в пикселях',
  'If enabled, relatives will only be shown when driving':
    'Если включено, относительная таблица показывается только во время езды',
  'Hide drivers in their pit stall': 'Скрывать пилотов в их боксах',
  'If enabled, drivers parked in their pit stall are removed from the relative instead of scrolling past lap after lap. Drivers driving down pit road, entering or exiting, are still shown.':
    'Если включено, пилоты, стоящие в своих боксах, убираются из относительной таблицы, а не проплывают мимо круг за кругом. Пилоты, едущие по пит-лейну на въезд или выезд, по-прежнему показываются.',
  'Pit Time': 'Время пит-стопа',
  'Pitlap display mode': 'Отображение круга пит-стопа',
  'Last pit lap': 'Круг последнего пит-стопа',
  'Laps since last pit': 'Кругов после пит-стопа',
  'Status Badges': 'Значки статуса',
  'Hide If Single Make': 'Скрывать, если марка одна',
  'Number of Laps to Show': 'Сколько кругов показывать',
  // sectordelta
  'Decimal precision for sector times and deltas. Always shown as total seconds.':
    'Точность времени секторов и дельт. Всегда показывается в секундах.',
  'Comparison Source': 'С чем сравнивать',
  'Choose what to compare sector times against.':
    'Выберите, с чем сравнивать время секторов.',
  'Ghost When Available': 'Призрак, если есть',
  'Session Best Only': 'Только лучшее в сессии',
  'Track incident sectors': 'Учитывать секторы с инцидентами',
  'When enabled, sectors with incidents are recorded and shown with a warning icon. When disabled, sectors with incidents are discarded.':
    'Если включено, секторы с инцидентами записываются и отмечаются значком предупреждения. Если выключено, такие секторы отбрасываются.',
  'Always scroll': 'Всегда прокручивать',
  'Keep the strip continuously scrolling with your position pinned to the center, even when all sectors fit in the widget.':
    'Лента всегда прокручивается, а ваша позиция закреплена по центру, даже если все секторы помещаются в виджет.',
  // shiftlight
  'Show RPM Text': 'Показывать текст RPM',
  'If enabled, Shift Light will only be shown when driving':
    'Если включено, индикатор переключения передач показывается только во время езды',
  // slowcarahead
  'Maximum Distance (m)': 'Максимальное расстояние (м)',
  'The maximum distance the slow car can be for the widget to be visible.':
    'Максимальное расстояние до медленной машины, при котором виджет виден.',
  'Slow Speed Threshold (km/h)': 'Порог медленной скорости (км/ч)',
  'The threshold for when a car is considered slow, and the widget will appear.':
    'Скорость, ниже которой машина считается медленной и появляется виджет.',
  'Stopped Speed Threshold (km/h)': 'Порог остановки (км/ч)',
  'The threshold for when a car is considered stopped, and the bar will turn red.':
    'Скорость, ниже которой машина считается остановившейся и полоса становится красной.',
  'Bar Thickness': 'Толщина полосы',
  'The thickness of the colored bar of the widget (px).':
    'Толщина цветной полосы виджета (px).',
  // standings
  'Position-based class ordering': 'Порядок классов по позиции',
  "If enabled, classes are ordered based on the class's leader's overall position (does not override class colors).":
    'Если включено, классы упорядочиваются по общей позиции лидера класса (цвета классов не меняются).',
  'Drivers to show in other classes': 'Пилотов в других классах',
  "Minimum drivers in player's class": 'Минимум пилотов в вашем классе',
  "Top drivers to always show in player's class":
    'Всегда показывать первых в вашем классе',
  'Top driver divider': 'Разделитель лидеров',
  'Theme Color': 'Цвет темы',
  'Show every driver': 'Показывать всех пилотов',
  'Lists the whole field instead of the drivers around you. Meant for the tall Gantry panel.':
    'Показывает всё поле, а не пилотов рядом с вами. Предназначено для высокой панели Gantry.',
  'Driver Row Opacity': 'Непрозрачность строк пилотов',
  'Adjust driver row backgrounds and the player highlight':
    'Настройка фона строк пилотов и выделения вашей строки',
  'Show Estimated Laps': 'Показывать прогноз кругов',
  "Show each class's projected total lap count in timed sessions, based on the class leader's current pace":
    'Показывать прогноз общего числа кругов для каждого класса в сессиях на время по текущему темпу лидера класса',
  'Laps to average': 'Кругов для усреднения',
  "Median of the class leader's most recent laps — pit stops and other outlier laps are left out":
    'Медиана последних кругов лидера класса — пит-стопы и другие выбивающиеся круги не учитываются',
  'If enabled, standings will only be shown when driving':
    'Если включено, таблица позиций показывается только во время езды',
  'Estimate During Practice': 'Прогнозировать в практике',
  'Rolling Laps': 'Кругов в скользящем среднем',
  'Gap Reference': 'Отставание от',
  'Player gaps are negative ahead and positive behind, across all classes. Uses the camera car when spectating; practice and qualifying compare best laps.':
    'При отсчёте от вас отставания машин впереди отрицательные, а сзади — положительные, во всех классах. При просмотре используется машина под камерой; в практике и квалификации сравниваются лучшие круги.',
  'Interval Display': 'Отображение интервала',
  'Choose how intervals are displayed when cars are a lap or more apart.':
    'Выберите, как показывать интервалы, когда машины разделяет круг или больше.',
  'Laps When Lapped': 'Круги при отставании на круг',
  'Driver Name Subtext': 'Подпись под именем пилота',
  'Team Name Subtext': 'Подпись под названием команды',
  // streamchat
  'Automatic message disappearance': 'Автоскрытие сообщений',
  'Messages will automatically disappear after the set time.':
    'Сообщения автоматически исчезают через заданное время.',
  'Disappearance interval': 'Время до исчезновения',
  'Show platform icons': 'Показывать значки платформ',
  'Show the Twitch or YouTube logo in front of each message to mark where it came from.':
    'Показывать логотип Twitch или YouTube перед каждым сообщением, чтобы было видно, откуда оно.',
  // tachometer
  'RPM Text Orientation': 'Ориентация текста RPM',
  'If enabled, tachometer will only be shown when driving':
    'Если включено, тахометр показывается только во время езды',
  // telemetryinspector (default inspected property)
  'Session Time': 'Время сессии',
  // weather
  Layout: 'Расположение',
  'Horizontal View': 'Горизонтальный вид',
  'Temperature Units': 'Единицы температуры',
  'If enabled, weather will only be shown when driving':
    'Если включено, погода показывается только во время езды',
  // wind
  'If enabled, wind will only be shown when driving':
    'Если включено, ветер показывается только во время езды',
} satisfies Record<string, string>;
