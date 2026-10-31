import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  simulatorHasDriverRatings,
  type ActiveSimulator,
} from '@irdashies/types';
import { BadgeCell } from './BadgeCell';

/**
 * Renders the cell as the widget does: the sim capability arrives as a prop,
 * resolved once per widget, so nothing here touches context.
 */
const cell = (
  props: Parameters<typeof BadgeCell>[0],
  simulator: ActiveSimulator | null = null
) =>
  render(
    <table>
      <tbody>
        <tr>
          <BadgeCell
            {...props}
            hasDriverRatings={simulatorHasDriverRatings(simulator)}
          />
        </tr>
      </tbody>
    </table>
  ).container.querySelector('[data-column="badge"]') as HTMLElement;

describe('BadgeCell under LMU', () => {
  it('draws nothing for a human whose rank has not arrived', () => {
    // The bug: the iRacing badge reads a missing licence and iRating as an AI
    // entry. Under LMU nobody has either, so every human was labelled "AI"
    // for the seconds before the rating service answered -- and for good, if
    // it never did.
    expect(cell({ lmuRating: undefined }, 'lmu').textContent).toBe('');
  });

  it('names an AI entry as one', () => {
    // The sim says it drives this car, so the placeholder is the truth about
    // it rather than an inference from a missing licence.
    expect(cell({ isAI: true }, 'lmu').textContent).toContain('AI');
  });

  it('keeps the two apart', () => {
    // The whole distinction: same absent rank, different reason.
    expect(cell({ isAI: true }, 'lmu').textContent).toContain('AI');
    expect(cell({ isAI: false }, 'lmu').textContent).toBe('');
    expect(cell({ isAI: undefined }, 'lmu').textContent).toBe('');
  });

  it('says nothing for an entry the sim did not call an AI', () => {
    // Undefined is not false: the badge only names an AI when the sim has
    // stated it is one, so an older build that reports no control leaves a
    // human unlabelled rather than guessing either way.
    expect(
      cell({ isAI: undefined, license: '', rating: 0 }, 'lmu').textContent
    ).toBe('');
  });

  it('names an AI that carries a country but no rank', () => {
    // AI entries are given a nationality and deliberately no rank, so the
    // LmuRating exists and the rank badge draws nothing for it. Keying the
    // branch on the object rather than on there being a rank would swallow
    // the placeholder.
    const shown = cell({ isAI: true, lmuRating: { countryCode: 'FR' } }, 'lmu');
    expect(shown.textContent).toContain('AI');
  });

  it('prefers a rank over the placeholder when there is one', () => {
    const shown = cell(
      { isAI: true, lmuRating: { driverRank: 'Gold', countryCode: 'FR' } },
      'lmu'
    );
    expect(shown.textContent).not.toContain('AI');
    expect(shown.childElementCount).toBeGreaterThan(0);
  });

  it('draws the rank once it arrives', () => {
    // Drawn as sprite art rather than text, so the assertion is on the
    // element: an empty cell has no children at all.
    const shown = cell(
      { lmuRating: { driverRank: 'Gold', safetyRank: 'Silver' } },
      'lmu'
    );
    expect(shown.childElementCount).toBeGreaterThan(0);
    expect(shown.textContent).not.toContain('AI');
  });

  it('leaves the cell empty, not merely free of the word AI', () => {
    expect(cell({ lmuRating: undefined }, 'lmu').childElementCount).toBe(0);
  });

  it('never shows the placeholder for a human, whatever they carry', () => {
    for (const props of [
      {},
      { license: 'A 4.00', rating: 3500 },
      { license: '', rating: 0 },
      { lmuRating: { countryCode: 'FR' } },
    ]) {
      expect(cell(props, 'lmu').textContent).not.toContain('AI');
    }
  });
});

describe('BadgeCell under iRacing', () => {
  it('still shows the AI placeholder, where it means something', () => {
    // iRacing's own AI entries carry no licence and no iRating, and calling
    // them out is the point of that badge.
    expect(cell({ license: '', rating: 0 }, 'iracing').textContent).toContain(
      'AI'
    );
  });

  it('still shows a licence and rating', () => {
    // Abbreviated by the badge itself; what matters here is that the iRacing
    // path still runs rather than exactly how it formats.
    expect(
      cell({ license: 'A 4.00', rating: 3500 }, 'iracing').textContent
    ).toContain('3.5k');
  });
});

describe('BadgeCell before a simulator is known', () => {
  it('keeps the iRacing behaviour, rather than guessing', () => {
    // simulatorHasDriverRatings defaults to true for the same reason
    // isWidgetDisabledForSim does: with no sim detected, hiding would be a
    // guess, and this is the path every existing iRacing install takes on the
    // first frames after launch.
    expect(cell({ license: '', rating: 0 }, null).textContent).toContain('AI');
  });
});

describe('BadgeCell default', () => {
  it('keeps the iRacing behaviour when the widget says nothing', () => {
    // Defaulting to true is what leaves every existing row spec, story and
    // caller behaving exactly as before this prop existed.
    const shown = render(
      <table>
        <tbody>
          <tr>
            <BadgeCell license="" rating={0} />
          </tr>
        </tbody>
      </table>
    ).container.querySelector('[data-column="badge"]') as HTMLElement;
    expect(shown.textContent).toContain('AI');
  });
});
