import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RacePlanBridge, RacePlanState } from '@irdashies/types';
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

afterEach(() => useRacePlanStore.setState({ state: null }));

describe('RacePlanSettings', () => {
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
