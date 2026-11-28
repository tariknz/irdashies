import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DamageBodyStyle } from '../bodyStyle';
import { BODY_FILL, SUSP_FILL } from '../logic';
import { CarSilhouette } from './CarSilhouette';

const STYLES: DamageBodyStyle[] = [
  'gtFront',
  'gtMid',
  'gtRear',
  'prototype',
  'openwheel',
  'hatch',
  'stock',
  'truck',
];

const LABEL_WIDTH = 3 * 9 * 0.6;

const renderStyle = (style: DamageBodyStyle, labels?: Record<string, string>) =>
  render(
    <CarSilhouette
      style={style}
      bodyStroke={[BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok]}
      wingFill={BODY_FILL.ok}
      wheelFill={[SUSP_FILL.ok, SUSP_FILL.ok, SUSP_FILL.ok, SUSP_FILL.ok]}
      suspFill={[BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok]}
      labels={labels}
    />
  ).container;

const drawing = (style: DamageBodyStyle) =>
  render(
    <CarSilhouette
      style={style}
      bodyStroke={[BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok]}
      wingFill={BODY_FILL.ok}
      wheelFill={[SUSP_FILL.ok, SUSP_FILL.ok, SUSP_FILL.ok, SUSP_FILL.ok]}
      suspFill={[BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok, BODY_FILL.ok]}
    />
  ).container.innerHTML;

describe('CarSilhouette', () => {
  it('draws every body style with its own outline', () => {
    expect(new Set(STYLES.map(drawing)).size).toBe(STYLES.length);
  });

  it.each(STYLES)(
    'keeps the corner labels of %s inside the drawing',
    (style) => {
      const container = renderStyle(style, {
        fl: '99%',
        fr: '99%',
        rl: '99%',
        rr: '99%',
      });
      const [minX, , width] = (
        container.querySelector('svg')?.getAttribute('viewBox') ?? ''
      )
        .split(' ')
        .map(Number);
      const corners = Array.from(container.querySelectorAll('text')).filter(
        (text) => text.textContent === '99%'
      );

      expect(corners).toHaveLength(4);
      for (const text of corners) {
        const x = Number(text.getAttribute('x'));
        if (text.getAttribute('text-anchor') === 'end') {
          expect(x - LABEL_WIDTH).toBeGreaterThanOrEqual(minX);
        } else {
          expect(x + LABEL_WIDTH).toBeLessThanOrEqual(minX + width);
        }
      }
    }
  );
});
