import type { ArgTypes, Decorator } from '@storybook/react-vite';
import type { WidgetBorderRadiusSettings } from '@irdashies/types';
import {
  MAX_BORDER_RADIUS,
  WIDGET_BORDER_RADIUS_CLASS,
  getWidgetBorderRadiusStyle,
} from '@irdashies/utils/borderRadius';

export interface BorderRadiusStoryArgs {
  globalBorderRadius: number;
  borderRadiusMode: WidgetBorderRadiusSettings['mode'];
  uniformBorderRadius: number;
  topLeftBorderRadius: number;
  topRightBorderRadius: number;
  bottomRightBorderRadius: number;
  bottomLeftBorderRadius: number;
}

export const borderRadiusStoryArgs = {
  globalBorderRadius: 2,
  borderRadiusMode: 'inherit',
  uniformBorderRadius: 8,
  topLeftBorderRadius: 0,
  topRightBorderRadius: 8,
  bottomRightBorderRadius: 16,
  bottomLeftBorderRadius: 24,
} as Record<string, unknown>;

export const borderRadiusStoryArgTypes: ArgTypes = {
  globalBorderRadius: {
    name: 'Global Radius',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    table: { category: 'Border Radius' },
  },
  borderRadiusMode: {
    name: 'Mode',
    control: 'select',
    options: ['inherit', 'uniform', 'corners'],
    table: { category: 'Border Radius' },
  },
  uniformBorderRadius: {
    name: 'Uniform Radius',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    if: { arg: 'borderRadiusMode', eq: 'uniform' },
    table: { category: 'Border Radius' },
  },
  topLeftBorderRadius: {
    name: 'Top Left',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    if: { arg: 'borderRadiusMode', eq: 'corners' },
    table: { category: 'Border Radius' },
  },
  topRightBorderRadius: {
    name: 'Top Right',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    if: { arg: 'borderRadiusMode', eq: 'corners' },
    table: { category: 'Border Radius' },
  },
  bottomRightBorderRadius: {
    name: 'Bottom Right',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    if: { arg: 'borderRadiusMode', eq: 'corners' },
    table: { category: 'Border Radius' },
  },
  bottomLeftBorderRadius: {
    name: 'Bottom Left',
    control: { type: 'range', min: 0, max: MAX_BORDER_RADIUS, step: 1 },
    if: { arg: 'borderRadiusMode', eq: 'corners' },
    table: { category: 'Border Radius' },
  },
};

const getStoryBorderRadiusSettings = (
  args: Partial<BorderRadiusStoryArgs>
): WidgetBorderRadiusSettings => {
  if (args.borderRadiusMode === 'uniform') {
    return {
      mode: 'uniform',
      radius: args.uniformBorderRadius,
    };
  }

  if (args.borderRadiusMode === 'corners') {
    return {
      mode: 'corners',
      corners: {
        topLeft: args.topLeftBorderRadius,
        topRight: args.topRightBorderRadius,
        bottomRight: args.bottomRightBorderRadius,
        bottomLeft: args.bottomLeftBorderRadius,
      },
    };
  }

  return { mode: 'inherit' };
};

export const BorderRadiusDecorator: Decorator = (Story, context) => {
  const args = context.args as Partial<BorderRadiusStoryArgs>;
  const style = getWidgetBorderRadiusStyle(getStoryBorderRadiusSettings(args), {
    borderRadius: args.globalBorderRadius,
  });

  return (
    <div className={WIDGET_BORDER_RADIUS_CLASS} style={style}>
      <Story />
    </div>
  );
};
