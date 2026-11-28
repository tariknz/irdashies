import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DamageBodyStyle } from '../bodyStyle';
import { BODY_FILL, SUSP_FILL } from '../logic';
import { CarSilhouette } from './CarSilhouette';

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
    const styles: DamageBodyStyle[] = [
      'gtFront',
      'gtMid',
      'gtRear',
      'prototype',
      'openwheel',
      'hatch',
      'stock',
      'truck',
    ];

    expect(new Set(styles.map(drawing)).size).toBe(styles.length);
  });
});
