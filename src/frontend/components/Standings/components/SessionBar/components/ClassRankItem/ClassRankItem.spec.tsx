import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionBarSnapshot } from '@irdashies/context';
import { ClassRankItem } from './ClassRankItem';

vi.mock('@irdashies/context');

describe('ClassRankItem', () => {
  it('excludes pace cars and spectators from the class total', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      playerClassified: true,
      playerClassPosition: 2,
      playerClassSize: 3,
    } as never);

    const { container } = render(
      <ClassRankItem settings={undefined} standalone={false} />
    );

    expect(container.textContent).toBe('2/3');
  });

  it('hides an unclassified player', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      playerClassified: false,
      playerClassPosition: 2,
      playerClassSize: 3,
    } as never);

    const { container } = render(
      <ClassRankItem settings={undefined} standalone={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('hides a player without a valid class size', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      playerClassified: true,
      playerClassPosition: 1,
      playerClassSize: 0,
    } as never);

    const { container } = render(
      <ClassRankItem settings={undefined} standalone={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
