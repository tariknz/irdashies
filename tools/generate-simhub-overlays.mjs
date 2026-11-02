import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const configPath = optionValue(
  '--config',
  path.join(process.env.APPDATA ?? '', 'irdashies', 'config.json')
);
const simhubDir = optionValue('--simhub', 'C:\\Program Files (x86)\\SimHub');
// Second screen: 3440x1440 at 100%, so a profile pixel is one screen pixel.
const screenWidth = Number(optionValue('--screen-width', '3440'));
const screenHeight = Number(optionValue('--screen-height', '1440'));

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const profileId = optionValue('--profile', config.currentProfile ?? 'default');
const dashboard = config.dashboards?.[profileId];
if (!dashboard) {
  throw new Error(`Profile "${profileId}" not found in ${configPath}`);
}
const profileName = config.profiles?.[profileId]?.name ?? profileId;
const safeName = (value) => value.replace(/[<>:"/\\|?*]/g, '_').trim();
const overlayName = (id) =>
  safeName(id.charAt(0).toUpperCase() + id.slice(1));

const textType =
  'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.TextItem, SimHub.Plugins';
const rectType =
  'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.RectangleItem, SimHub.Plugins';
const barType =
  'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ProgressBarItem, SimHub.Plugins';
const mapType =
  'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.GeneratedStaticMapItem, SimHub.Plugins';
const radarType =
  'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.RadarItem, SimHub.Plugins';

const game = 'DataCorePlugin.GameData.NewData';
const computed = 'DataCorePlugin.Computed';

function g(name) {
  return `[${game}.${name}]`;
}

function slot(side, index, field) {
  return `[PersistantTrackerPlugin.Driver${side}_${String(index).padStart(2, '0')}_${field}]`;
}

function bind(target, expression) {
  return {
    Formula: { Expression: expression },
    Mode: 2,
    TargetPropertyName: target,
  };
}

function text(opts) {
  const item = {
    $type: textType,
    IsTextItem: true,
    Font: 'Segoe UI',
    FontSize: opts.size ?? 18,
    Text: opts.text ?? '',
    TextColor: opts.color ?? '#FFFFFFFF',
    HorizontalAlignment: opts.align ?? 0,
    VerticalAlignment: opts.valign ?? 1,
    BackgroundColor: opts.bg ?? '#00000000',
    Left: opts.left,
    Top: opts.top,
    Width: opts.width,
    Height: opts.height,
    Visible: true,
    Name: opts.name,
  };
  if (opts.bindings) item.Bindings = opts.bindings;
  return item;
}

function rect(opts) {
  const item = {
    $type: rectType,
    IsRectangleItem: true,
    BackgroundColor: opts.color,
    Left: opts.left,
    Top: opts.top,
    Width: opts.width,
    Height: opts.height,
    Visible: true,
    Name: opts.name,
  };
  if (opts.bindings) item.Bindings = opts.bindings;
  return item;
}

function bar(opts) {
  const bindings = { Value: bind('Value', opts.expression) };
  if (opts.maximum) bindings.Maximum = bind('Maximum', opts.maximum);
  return {
    $type: barType,
    AutoSize: false,
    ProgressBarColor: opts.color,
    Minimum: 0,
    Maximum: opts.max ?? 100,
    Value: 0,
    Steps: 0,
    ProgressBarAlignment: 0,
    BackgroundColor: opts.track ?? '#33FFFFFF',
    Left: opts.left,
    Top: opts.top,
    Width: opts.width,
    Height: opts.height,
    Visible: true,
    Name: opts.name,
    Bindings: bindings,
  };
}

function namedGap(side, index) {
  const name = slot(side, index, 'Name');
  const gap = slot(side, index, 'Gap');
  return `if(isnull(${name},'')='','',isnull(${name},'') + '  ' + format(isnull(${gap},0),'0.00'))`;
}

function hasName(side, index) {
  return `if(isnull(${slot(side, index, 'Name')},'')!='',1,0)`;
}

const flagOrder = [
  ['Flag_Black', 'BLACK', '#FF111111'],
  ['Flag_Orange', 'ORANGE', '#FFFF7A00'],
  ['Flag_Blue', 'BLUE', '#FF1E90FF'],
  ['Flag_Yellow', 'YELLOW', '#FFFFD000'],
  ['Flag_Checkered', 'CHECKERED', '#FFD0D0D0'],
  ['Flag_White', 'WHITE', '#FFF2F2F2'],
  ['Flag_Green', 'GREEN', '#FF1B8F1B'],
];

function flagText() {
  let nested = "''";
  for (const [field, label] of [...flagOrder].reverse()) {
    nested = `if(${g(field)},'${label}',${nested})`;
  }
  return `if(${g('Flag_Name')}!='',${g('Flag_Name')},${nested})`;
}

function flagVisible() {
  const any = flagOrder.map(([field]) => g(field)).join(' || ');
  return `if(${g('Flag_Name')}!='' || ${any},1,0)`;
}

function itemsFlag(w, h) {
  const show = flagVisible();
  const items = [...flagOrder].reverse().map(([field, label, color]) =>
    rect({
      name: label,
      color,
      left: 0,
      top: 0,
      width: w,
      height: h,
      bindings: { Visible: bind('Visible', `if(${g(field)},1,0)`) },
    })
  );
  items.push(
    text({
      name: 'FlagName',
      text: 'FLAG',
      left: 0,
      top: Math.round(h * 0.62),
      width: w,
      height: Math.round(h * 0.38),
      size: 18,
      align: 1,
      bg: '#CC000000',
      bindings: {
        Text: bind('Text', flagText()),
        Visible: bind('Visible', show),
      },
    })
  );
  return items;
}

function itemsInput(w, h) {
  const rows = [
    ['T', 'Throttle', '#FF3DDC6A'],
    ['B', 'Brake', '#FFFF4D4D'],
    ['C', 'Clutch', '#FF4DA3FF'],
  ];
  const rowH = Math.floor((h - 6) / rows.length);
  const barW = Math.round(w * 0.62);
  const items = [];
  rows.forEach(([label, propName, color], index) => {
    const top = 3 + index * rowH;
    items.push(
      text({
        name: label,
        text: label,
        left: 4,
        top,
        width: 22,
        height: rowH,
        size: 14,
        color: '#FFDDDDDD',
      })
    );
    items.push(
      bar({
        name: propName,
        left: 28,
        top: top + 4,
        width: barW,
        height: Math.max(8, rowH - 8),
        color,
        expression: g(propName),
      })
    );
  });
  const infoLeft = 28 + barW + 8;
  items.push(
    text({
      name: 'Gear',
      text: 'N',
      left: infoLeft,
      top: 0,
      width: w - infoLeft,
      height: Math.round(h * 0.62),
      size: 32,
      align: 1,
      bindings: { Text: bind('Text', g('Gear')) },
    })
  );
  items.push(
    text({
      name: 'Speed',
      text: '0',
      left: infoLeft,
      top: Math.round(h * 0.58),
      width: w - infoLeft,
      height: Math.round(h * 0.42),
      size: 16,
      align: 1,
      bindings: {
        Text: bind(
          'Text',
          `format(${g('SpeedLocal')},'0') + ' ' + isnull(${g('SpeedLocalUnit')},'')`
        ),
      },
    })
  );
  return items;
}

function itemsTachometer(w, h) {
  const textH = Math.round(h * 0.55);
  return [
    text({
      name: 'RpmText',
      text: '0',
      left: 0,
      top: 0,
      width: w,
      height: textH,
      size: 20,
      align: 1,
      bindings: { Text: bind('Text', `format(${g('Rpms')},'0')`) },
    }),
    bar({
      name: 'Rpm',
      left: 0,
      top: textH,
      width: w,
      height: h - textH,
      color: '#FFFFB000',
      max: 10000,
      expression: g('Rpms'),
      maximum: `if(isnull(${g('MaxRpm')},0)<1,10000,${g('MaxRpm')})`,
    }),
  ];
}

function itemsRelative(w, h) {
  const rows = [
    ['Ahead1', 'Ahead', 1],
    ['Ahead0', 'Ahead', 0],
    ['Behind0', 'Behind', 0],
    ['Behind1', 'Behind', 1],
  ];
  const rowH = Math.floor(h / (rows.length + 2));
  const nameW = Math.round(w * 0.7);
  const items = [
    text({
      name: 'Header',
      text: 'RELATIVE',
      left: 0,
      top: 0,
      width: w,
      height: rowH,
      size: 14,
      color: '#FFFFB000',
      bg: '#66000000',
    }),
  ];
  rows.slice(0, 2).forEach(([name, side, index], row) => {
    const top = rowH * (row + 1);
    items.push(
      text({
        name: `${name}Name`,
        text: '',
        left: 6,
        top,
        width: nameW - 6,
        height: rowH,
        size: 16,
        bindings: {
          Text: bind('Text', `isnull(${slot(side, index, 'Name')},'')`),
          Visible: bind('Visible', hasName(side, index)),
        },
      }),
      text({
        name: `${name}Gap`,
        text: '',
        left: nameW,
        top,
        width: w - nameW - 6,
        height: rowH,
        size: 16,
        align: 2,
        bindings: {
          Text: bind(
            'Text',
            `if(isnull(${slot(side, index, 'Name')},'')='','',format(isnull(${slot(side, index, 'Gap')},0),'0.00'))`
          ),
          Visible: bind('Visible', hasName(side, index)),
        },
      })
    );
  });
  items.push(
    text({
      name: 'You',
      text: 'YOU',
      left: 0,
      top: rowH * 3,
      width: w,
      height: rowH,
      size: 16,
      align: 1,
      color: '#FFFFE14A',
      bg: '#66000000',
      bindings: {
        Text: bind('Text', `'P' + format(isnull(${g('Position')},0),'0') + '  YOU'`),
      },
    })
  );
  rows.slice(2).forEach(([name, side, index], row) => {
    const top = rowH * (row + 4);
    items.push(
      text({
        name: `${name}Name`,
        text: '',
        left: 6,
        top,
        width: nameW - 6,
        height: rowH,
        size: 16,
        bindings: {
          Text: bind('Text', `isnull(${slot(side, index, 'Name')},'')`),
          Visible: bind('Visible', hasName(side, index)),
        },
      }),
      text({
        name: `${name}Gap`,
        text: '',
        left: nameW,
        top,
        width: w - nameW - 6,
        height: rowH,
        size: 16,
        align: 2,
        bindings: {
          Text: bind(
            'Text',
            `if(isnull(${slot(side, index, 'Name')},'')='','',format(isnull(${slot(side, index, 'Gap')},0),'0.00'))`
          ),
          Visible: bind('Visible', hasName(side, index)),
        },
      })
    );
  });
  return items;
}

function itemsMap(w, h) {
  const dot = (color, border, radius) => ({
    LabelFont: 'Segoe UI',
    LabelFontSize: 12,
    LabelColor: '#FFFFFFFF',
    DotColor: color,
    DotBorderThickness: 2,
    DotBordercolor: border,
    DotRadius: radius,
  });
  return [
    {
      $type: mapType,
      AlternateTrackSectorColor: '#FF000000',
      CursorColor: '#FFFF0000',
      DisplayScale: 1,
      MapShadow: true,
      MinimumTrackBorderWidth: 0,
      MinimumTrackWidth: 4,
      OpponentStyle: dot('#FFFFFFFF', '#FF87CEFA', 14),
      PlayerStyle: dot('#FFFF0000', '#FFFFFFFF', 16),
      StartLine: { Color: '#FFFF0000', Enabled: true, Height: 20, Width: 4 },
      TrackBorderColor: '#FFFFFFFF',
      TrackBorderWidth: 2,
      TrackColor: '#FF222222',
      TrackWidth: 8,
      BackgroundColor: '#00000000',
      Left: 0,
      Top: 0,
      Width: w,
      Height: h,
      Visible: true,
      Name: 'Map',
    },
  ];
}

function itemsFaster(w, h) {
  return [
    text({
      name: 'Behind',
      text: '',
      left: 0,
      top: 0,
      width: w,
      height: h,
      size: 18,
      align: 1,
      bg: '#CC7A0000',
      bindings: {
        Text: bind('Text', namedGap('Behind', 0)),
        Visible: bind('Visible', hasName('Behind', 0)),
      },
    }),
  ];
}

function itemsFuel(w, h) {
  const rows = [
    ['Fuel', 'FUEL', `format(isnull(${g('Fuel')},0),'0.0') + ' ' + isnull(${g('FuelUnit')},'')`],
    ['Laps', 'LAPS', `format(isnull([${computed}.Fuel_RemainingLaps],0),'0.0')`],
    ['Last', 'LAST', `format(isnull([${computed}.Fuel_LastLapConsumption],0),'0.00')`],
    ['Time', 'TIME', `format(isnull([${computed}.Fuel_RemainingTime],0),'mm\\:ss')`],
  ];
  const rowH = Math.floor((h - 28) / (rows.length + 1));
  const labelW = 110;
  const items = rows.map(([name, label, expression], index) => [
    text({
      name: `${name}Label`,
      text: label,
      left: 8,
      top: index * rowH,
      width: labelW,
      height: rowH,
      size: 18,
      color: '#FFFFB000',
    }),
    text({
      name,
      text: '0',
      left: labelW,
      top: index * rowH,
      width: w - labelW - 8,
      height: rowH,
      size: 22,
      align: 2,
      bindings: { Text: bind('Text', expression) },
    }),
  ]);
  const barTop = rows.length * rowH + 6;
  return [
    rect({
      name: 'Plate',
      color: '#99000000',
      left: 0,
      top: 0,
      width: w,
      height: h,
    }),
    ...items.flat(),
    bar({
      name: 'Percent',
      left: 8,
      top: barTop,
      width: w - 16,
      height: Math.max(12, h - barTop - 8),
      color: '#FF3DDC6A',
      expression: `isnull([${computed}.Fuel_Percent],0)`,
    }),
  ];
}

function itemsBlind(w, h) {
  const side = Math.max(72, Math.round(w * 0.14));
  const top = Math.round(h * 0.22);
  const height = Math.round(h * 0.56);
  const leftOn = `if(isnull(${g('SpotterCarLeftDistance')},0)>0,1,0)`;
  const rightOn = `if(isnull(${g('SpotterCarRightDistance')},0)>0,1,0)`;
  return [
    rect({
      name: 'LeftCar',
      color: '#FFFF8C00',
      left: 0,
      top,
      width: side,
      height,
      bindings: { Visible: bind('Visible', leftOn) },
    }),
    text({
      name: 'LeftDist',
      text: '',
      left: 0,
      top: top + Math.round(height / 2) - 16,
      width: side,
      height: 32,
      size: 16,
      align: 1,
      color: '#FF111111',
      bindings: {
        Text: bind('Text', `format(isnull(${g('SpotterCarLeftDistance')},0),'0')`),
        Visible: bind('Visible', leftOn),
      },
    }),
    rect({
      name: 'RightCar',
      color: '#FFFF8C00',
      left: w - side,
      top,
      width: side,
      height,
      bindings: { Visible: bind('Visible', rightOn) },
    }),
    text({
      name: 'RightDist',
      text: '',
      left: w - side,
      top: top + Math.round(height / 2) - 16,
      width: side,
      height: 32,
      size: 16,
      align: 1,
      color: '#FF111111',
      bindings: {
        Text: bind('Text', `format(isnull(${g('SpotterCarRightDistance')},0),'0')`),
        Visible: bind('Visible', rightOn),
      },
    }),
  ];
}

function itemsRejoin(w, h) {
  const show = `if(${g('LapInvalidated')} || ${g('IsInPitLane')},1,0)`;
  return [
    rect({
      name: 'Plate',
      color: '#CC8B0000',
      left: Math.round(w * 0.15),
      top: Math.round(h * 0.28),
      width: Math.round(w * 0.7),
      height: Math.round(h * 0.44),
      bindings: { Visible: bind('Visible', show) },
    }),
    text({
      name: 'Warning',
      text: '',
      left: Math.round(w * 0.15),
      top: Math.round(h * 0.28),
      width: Math.round(w * 0.7),
      height: Math.round(h * 0.44),
      size: 42,
      align: 1,
      bindings: {
        Text: bind(
          'Text',
          `if(${g('LapInvalidated')},'LAP INVALID',if(${g('IsInPitLane')},'PIT LANE',''))`
        ),
        Visible: bind('Visible', show),
      },
    }),
  ];
}

function itemsSlow(w, h) {
  const near = `isnull(${slot('Ahead', 0, 'Distance')},0)>0 && isnull(${slot('Ahead', 0, 'Distance')},0)<80`;
  const show = `if(isnull(${slot('Ahead', 0, 'Name')},'')!='' && ${near},1,0)`;
  return [
    text({
      name: 'Ahead',
      text: '',
      left: 0,
      top: 0,
      width: w,
      height: h,
      size: 18,
      align: 1,
      bg: '#CC7A5A00',
      bindings: {
        Text: bind(
          'Text',
          `if(isnull(${slot('Ahead', 0, 'Name')},'')='','',isnull(${slot('Ahead', 0, 'Name')},'') + '  ' + format(isnull(${slot('Ahead', 0, 'Distance')},0),'0') + 'm  ' + format(isnull(${slot('Ahead', 0, 'Gap')},0),'0.00'))`
        ),
        Visible: bind('Visible', show),
      },
    }),
  ];
}

function itemsPit(w, h) {
  const show = `if(${g('PitLimiterOn')},1,0)`;
  return [
    rect({
      name: 'Plate',
      color: '#CC005500',
      left: 0,
      top: 0,
      width: w,
      height: h,
      bindings: { Visible: bind('Visible', show) },
    }),
    text({
      name: 'Title',
      text: 'PIT',
      left: 0,
      top: 8,
      width: w,
      height: Math.round(h * 0.4),
      size: 28,
      align: 1,
      bindings: { Visible: bind('Visible', show) },
    }),
    text({
      name: 'Limit',
      text: '',
      left: 4,
      top: Math.round(h * 0.4),
      width: w - 8,
      height: Math.round(h * 0.28),
      size: 18,
      align: 1,
      bindings: {
        Text: bind(
          'Text',
          `if(isnull(${g('PitLimiterSpeed')},0)>0,format(${g('PitLimiterSpeed')},'0') + ' ' + isnull(${g('SpeedLocalUnit')},''),'LIMIT')`
        ),
        Visible: bind('Visible', show),
      },
    }),
    text({
      name: 'Speed',
      text: '',
      left: 4,
      top: Math.round(h * 0.68),
      width: w - 8,
      height: Math.round(h * 0.28),
      size: 16,
      align: 1,
      bindings: {
        Text: bind(
          'Text',
          `format(${g('SpeedLocal')},'0') + ' ' + isnull(${g('SpeedLocalUnit')},'')`
        ),
        Visible: bind('Visible', show),
      },
    }),
  ];
}

function itemsInfobar(w, h) {
  const lap = `if(isnull(${g('TotalLaps')},0)>0,format(isnull(${g('CurrentLap')},0),'0') + '/' + format(${g('TotalLaps')},'0'),format(isnull(${g('CurrentLap')},0),'0'))`;
  const remaining = `if(isnull(${g('SessionTimeLeft')},0)>0,format(${g('SessionTimeLeft')},'hh\\:mm\\:ss'),'--')`;
  const temp = `format(isnull(${g('RoadTemperature')},0),'0') + isnull(${g('TemperatureUnit')},'')`;
  const expression = `isnull(${g('SessionTypeName')},'') + '  ' + ${lap} + '  ' + ${remaining} + '  ' + ${temp} + '  ' + format([Clock],'HH:mm')`;
  return [
    rect({
      name: 'Plate',
      color: '#99000000',
      left: 0,
      top: 0,
      width: w,
      height: h,
    }),
    text({
      name: 'Info',
      text: '',
      left: 8,
      top: 0,
      width: w - 16,
      height: h,
      size: 16,
      bindings: { Text: bind('Text', expression) },
    }),
  ];
}

function itemsSector(w, h) {
  return [
    rect({
      name: 'Plate',
      color: '#99000000',
      left: 0,
      top: 0,
      width: w,
      height: h,
    }),
    text({
      name: 'Delta',
      text: '0.000',
      left: 8,
      top: 0,
      width: w - 16,
      height: h,
      size: 22,
      align: 1,
      bindings: {
        Text: bind(
          'Text',
          `'S' + format(isnull(${g('CurrentSectorIndex')},0),'0') + '  ' + format(isnull(${g('SelfsplitDelta')},0),'+0.000;-0.000')`
        ),
        TextColor: {
          Formula: { Expression: `isnull(${g('SelfsplitDelta')},0)` },
          StartColor: '#FF3DDC6A',
          EnableMiddleColor: true,
          MiddleColor: '#FFFFFFFF',
          MiddleColorValue: 0,
          EndColor: '#FFFF4D4D',
          StartColorValue: -0.5,
          EndColorValue: 0.5,
          Mode: 4,
          TargetPropertyName: 'TextColor',
        },
      },
    }),
  ];
}

function itemsRadar(w, h) {
  const style = (color, border, radius) => ({
    LabelFont: 'Segoe UI',
    LabelFontSize: 12,
    LabelColor: '#FFFFFFFF',
    DotColor: color,
    DotBorderThickness: 2,
    DotBordercolor: border,
    DotRadius: radius,
  });
  return [
    {
      $type: radarType,
      PlayerStyle: style('#FFFF0000', '#FFFFFFFF', 16),
      OpponentStyle: style('#FFFFFFFF', '#FF1E90FF', 12),
      Scale: 1,
      BackgroundColor: '#00000000',
      Left: 0,
      Top: 0,
      Width: w,
      Height: h,
      Visible: true,
      Name: 'Radar',
    },
  ];
}

const nativeItems = {
  flag: itemsFlag,
  input: itemsInput,
  tachometer: itemsTachometer,
  relative: itemsRelative,
  map: itemsMap,
  fastercarsfrombehind: itemsFaster,
  fuel: itemsFuel,
  blindspotmonitor: itemsBlind,
  rejoin: itemsRejoin,
  slowcarahead: itemsSlow,
  pitlanehelper: itemsPit,
  infobar: itemsInfobar,
  sectordelta: itemsSector,
  radar: itemsRadar,
};

function itemsFor(widget, w, h) {
  const build = nativeItems[widget.id];
  if (build) return build(w, h);
  return [
    text({
      name: overlayName(widget.id),
      text: overlayName(widget.id),
      left: 0,
      top: 0,
      width: w,
      height: h,
      size: 16,
      align: 1,
      color: '#FFBBBBBB',
    }),
  ];
}

function buildDash(widget, width, height) {
  const metadata = {
    Author: 'irDashies',
    ScreenCount: 1.0,
    InGameScreensIndexs: [0],
    IdleScreensIndexs: [],
    PitScreensIndexs: [],
    MainPreviewIndex: 0,
    IsOverlay: true,
    ShowInTaskBar: false,
    Width: width,
    Height: height,
    OverlaySizeWarning: false,
    MetadataVersion: 2.0,
    EnableOnDashboardMessaging: false,
  };
  const dash = {
    Version: 2,
    Id: randomUUID(),
    BaseWidth: width,
    BaseHeight: height,
    BackgroundColor: '#00000000',
    Screens: [
      {
        RenderingSkip: 0,
        InGameScreen: true,
        IdleScreen: false,
        PitScreen: false,
        BackgroundColor: '#00FFFFFF',
        IsSelected: true,
        Id: randomUUID(),
        Name: widget.id,
        Items: itemsFor(widget, width, height),
      },
    ],
    Images: [],
    Metadata: metadata,
    IsOverlay: true,
    ShowInTaskBar: false,
    ShowOnScreenControls: false,
    EnableClickThroughOverlay: true,
    EnableOnDashboardMessaging: false,
  };
  return { dash, metadata };
}

function screenOrigin() {
  const script = `
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class MonEnum {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprc, MonitorEnumProc lpfn, IntPtr dwData);
  public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, ref RECT lprc, IntPtr dwData);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr hmon, int type, out uint dx, out uint dy);
  static List<string> rows = new List<string>();
  static bool Callback(IntPtr h, IntPtr hdc, ref RECT r, IntPtr data) {
    uint dx, dy;
    GetDpiForMonitor(h, 0, out dx, out dy);
    rows.Add(r.Left + "," + r.Top + "," + (r.Right - r.Left) + "," + (r.Bottom - r.Top) + "," + dx);
    return true;
  }
  public static string Run() {
    rows.Clear();
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, Callback, IntPtr.Zero);
    return string.Join("\\n", rows);
  }
}
"@
[MonEnum]::Run()
`;
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', script],
    { encoding: 'utf8' }
  );
  const monitors = (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-?\d+,-?\d+,\d+,\d+,\d+$/.test(line))
    .map((line) => {
      const [x, y, w, h, dpi] = line.split(',').map(Number);
      return { x, y, w, h, dpi };
    });
  const target = monitors.find(
    (monitor) => monitor.w === screenWidth && monitor.h === screenHeight
  );
  if (!target) return { x: 0, y: 0, found: false, monitors };
  const scale = target.dpi / 96;
  return {
    x: Math.round(target.x / scale),
    y: Math.round(target.y / scale),
    found: true,
    monitors,
  };
}

const templatesDir = path.join(simhubDir, 'DashTemplates');
const stalePrefix = `irDashies ${profileName} - `;
if (fs.existsSync(templatesDir)) {
  for (const entry of fs.readdirSync(templatesDir)) {
    if (entry.startsWith(stalePrefix)) {
      fs.rmSync(path.join(templatesDir, entry), { recursive: true, force: true });
    }
  }
}

const origin = screenOrigin();
const enabled = [];
for (const widget of dashboard.widgets) {
  const { width, height } = widget.layout;
  const w = Math.round(width);
  const h = Math.round(height);
  const dashName = overlayName(widget.id);
  const dir = path.join(simhubDir, 'DashTemplates', dashName);
  const { dash, metadata } = buildDash(widget, w, h);
  const body = JSON.stringify(dash);
  if (body.includes('localhost') || body.includes('WebPageItem')) {
    throw new Error(`${dashName} still points at a web page`);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${dashName}.djson`), JSON.stringify(dash, null, 2));
  fs.writeFileSync(
    path.join(dir, `${dashName}.djson.metadata`),
    JSON.stringify(metadata, null, 2)
  );
  if (widget.enabled) enabled.push(dashName);
  process.stdout.write(
    `${widget.enabled ? 'native ' : 'label  '}  ${dashName}\n`
  );
}

const layoutName = safeName(`irDashies ${profileName}`);
const layoutPath = path.join(simhubDir, 'OverlayLayouts', `${layoutName}.olayout`);
if (fs.existsSync(layoutPath)) {
  process.stdout.write(`layout unchanged: ${layoutName}\n`);
} else {
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  const parts = dashboard.widgets
    .filter((widget) => widget.enabled)
    .map((widget) => ({
      DashboardName: overlayName(widget.id),
      Left: Math.round(widget.layout.x) + origin.x,
      Top: Math.round(widget.layout.y) + origin.y,
      Width: Math.round(widget.layout.width),
      Height: Math.round(widget.layout.height),
      Version: 1,
      PartId: randomUUID(),
      Placed: true,
      Transparent: true,
    }));
  fs.writeFileSync(
    layoutPath,
    JSON.stringify(
      {
        OverlayLayoutParts: parts,
        AutoMode: 0,
        ShowWhenPausedOrInMenu: false,
        Name: layoutName,
        UniqueId: randomUUID(),
        Version: 1,
        SaveLastScreens: false,
      },
      null,
      2
    )
  );
}

const past = dashboard.widgets.filter(
  (widget) =>
    widget.layout.x + widget.layout.width > screenWidth ||
    widget.layout.y + widget.layout.height > screenHeight
);
process.stdout.write(
  `\n${dashboard.widgets.length} native overlays, ${enabled.length} enabled\n` +
    `screen ${screenWidth}x${screenHeight} @ 100%` +
    (origin.found
      ? `, monitor origin ${origin.x},${origin.y} (layout file not moved)\n`
      : `, origin 0,0 (that screen is not active in Windows)\n`)
);
if (past.length) {
  process.stdout.write(
    `past the screen: ${past.map((widget) => widget.id).join(', ')}\n`
  );
}
