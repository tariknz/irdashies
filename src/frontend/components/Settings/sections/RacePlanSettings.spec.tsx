import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RacePlanBridge,
  RacePlanListing,
  RacePlanListResult,
  RacePlanState,
} from '@irdashies/types';
import { useRacePlanStore } from '@irdashies/context';
import { RacePlanSettings } from './RacePlanSettings';

const state: RacePlanState = {
  config: { planningId: null, strategyId: null, refreshMinutes: 5 },
  hasApiKey: true,
  canStoreApiKey: true,
  status: 'idle',
  fetchedAt: null,
  planning: null,
  strategyId: null,
};

const bridgeFor = (
  choosePlanning: RacePlanBridge['choosePlanning']
): RacePlanBridge => ({
  getState: () => Promise.resolve(state),
  choosePlanning: vi.fn(choosePlanning),
  setConfig: () => Promise.resolve(state),
  setApiKey: () => Promise.resolve(state),
  clearApiKey: () => Promise.resolve(state),
  listPlannings: () => Promise.resolve({ status: 'ok', plannings: [] }),
  refreshNow: () => Promise.resolve(state),
  onStateChanged: () => () => undefined,
});

const enterPlanningId = async (id: string) => {
  fireEvent.change(await screen.findByLabelText('Planning ID'), {
    target: { value: id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Use' }));
};

const listing: RacePlanListing = {
  id: 123,
  name: 'Account A race',
  car: null,
  isTeam: true,
  trackName: null,
  startAt: null,
};

const accountBridge = () => {
  const bridge = bridgeFor(async () => ({ status: 'ok', state }));
  let onChange: ((next: RacePlanState) => void) | undefined;
  bridge.onStateChanged = (callback) => {
    onChange = callback;
    return () => {
      onChange = undefined;
    };
  };
  bridge.clearApiKey = async () => {
    const next = { ...state, hasApiKey: false };
    onChange?.(next);
    return next;
  };
  bridge.setApiKey = async () => {
    onChange?.(state);
    return state;
  };
  return bridge;
};

const replaceKey = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  fireEvent.change(await screen.findByLabelText('API key'), {
    target: { value: 'account-b-key' },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('combobox', { name: 'Planning' });
};

afterEach(() => {
  cleanup();
  useRacePlanStore.setState({ state: null });
});

describe('RacePlanSettings', () => {
  it('clears account listings when the API key changes', async () => {
    const bridge = accountBridge();
    bridge.listPlannings = async () => ({ status: 'ok', plannings: [listing] });
    render(<RacePlanSettings bridge={bridge} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load list' }));
    await screen.findByRole('option', { name: /Account A race/ });

    await replaceKey();
    expect(screen.queryByRole('option', { name: /Account A race/ })).toBeNull();
  });

  it.each(['ok', 'unauthorized', 'reject'] as const)(
    'ignores an old account list request that finishes with %s',
    async (status) => {
      const bridge = accountBridge();
      let resolve!: (result: RacePlanListResult) => void;
      let reject!: (reason: Error) => void;
      const pending = new Promise<RacePlanListResult>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      bridge.listPlannings = vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce({
          status: 'ok',
          plannings: [{ ...listing, id: 456, name: 'Account B race' }],
        });
      render(<RacePlanSettings bridge={bridge} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Load list' }));
      await replaceKey();
      fireEvent.click(screen.getByRole('button', { name: 'Load list' }));
      await screen.findByRole('option', { name: /Account B race/ });

      await act(async () => {
        if (status === 'reject') reject(new Error('Old account disconnected'));
        else if (status === 'ok') resolve({ status, plannings: [listing] });
        else resolve({ status });
      });
      expect(
        screen.getByRole('option', { name: /Account B race/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: /Account A race/ })
      ).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText('Could not load your plannings')).toBeNull();
    }
  );

  it('shows a message for an unknown planning ID and keeps it to correct', async () => {
    const bridge = bridgeFor(async () => ({ status: 'not-found' }));
    render(<RacePlanSettings bridge={bridge} />);
    await enterPlanningId('123');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'iRacePlan has no planning with ID 123'
    );
    expect(bridge.choosePlanning).toHaveBeenCalledWith(123);
    expect(screen.getByLabelText('Planning ID')).toHaveValue('123');
    const select = screen.getByRole('combobox', { name: 'Planning' });
    expect(select).toHaveValue('');
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual([
      '',
    ]);
  });

  it('says the planning was not changed when iRacePlan cannot be reached', async () => {
    render(
      <RacePlanSettings
        bridge={bridgeFor(async () => ({ status: 'network' }))}
      />
    );
    await enterPlanningId('123');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach iRacePlan. The planning was not changed.'
    );
  });

  it('clears the ID box once the planning loads', async () => {
    render(
      <RacePlanSettings
        bridge={bridgeFor(async () => ({ status: 'ok', state }))}
      />
    );
    await enterPlanningId('123');
    await waitFor(() =>
      expect(screen.getByLabelText('Planning ID')).toHaveValue('')
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects an ID that is not a whole number without asking iRacePlan', async () => {
    const bridge = bridgeFor(async () => ({ status: 'not-found' }));
    render(<RacePlanSettings bridge={bridge} />);
    await enterPlanningId('12a');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A planning ID is a whole number'
    );
    expect(bridge.choosePlanning).not.toHaveBeenCalled();
  });

  it('asks for the API key before a planning can be chosen', async () => {
    const bridge = bridgeFor(async () => ({ status: 'not-found' }));
    bridge.getState = () => Promise.resolve({ ...state, hasApiKey: false });
    render(<RacePlanSettings bridge={bridge} />);
    expect(
      await screen.findByText('Save your API key first to choose a planning.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Planning ID')).toBeNull();
  });
});
