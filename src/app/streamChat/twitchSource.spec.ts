import { describe, it, expect, vi } from 'vitest';
import { createTwitchSource, type TwitchClient } from './twitchSource';

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const fakeClient = () => {
  const listeners = new Map<string, (...args: never[]) => void>();
  const client: TwitchClient = {
    connect: vi.fn(),
    close: vi.fn(),
    on: (event, listener) => {
      listeners.set(event, listener);
      return client;
    },
  };
  const emit = (event: string, payload?: unknown) =>
    (listeners.get(event) as ((p?: unknown) => void) | undefined)?.(payload);
  return { client, emit };
};

const setup = () => {
  const clients: ReturnType<typeof fakeClient>[] = [];
  const events = {
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    onRoomId: vi.fn(),
  };
  const create = vi.fn(() => {
    const next = fakeClient();
    clients.push(next);
    return next.client;
  });
  return {
    source: createTwitchSource(events, create),
    events,
    clients,
    create,
  };
};

describe('twitchSource', () => {
  it('connects to the channel and reports status', () => {
    const { source, events, clients, create } = setup();
    source.setChannel('abc');
    expect(create).toHaveBeenCalledWith('abc');
    expect(clients[0].client.connect).toHaveBeenCalled();
    expect(events.onStatus).toHaveBeenLastCalledWith('connecting');
    clients[0].emit('connect');
    expect(events.onStatus).toHaveBeenLastCalledWith('connected');
  });

  it('forwards messages with a name and text, as the old hook did', () => {
    const { source, events, clients } = setup();
    source.setChannel('abc');
    clients[0].emit('message', {
      user: { display: 'Disp', login: 'login', color: '#fff' },
      message: { text: 'hi', emotes: [{ id: '25', indices: [[0, 1]] }] },
    });
    expect(events.onMessage).toHaveBeenCalledWith({
      user: 'Disp',
      color: '#fff',
      text: 'hi',
      emotes: [{ id: '25', indices: [[0, 1]] }],
    });
  });

  it('falls back to the login and skips empty messages', () => {
    const { source, events, clients } = setup();
    source.setChannel('abc');
    clients[0].emit('message', {
      user: { login: 'login', color: '' },
      message: { text: 'hey' },
    });
    clients[0].emit('message', { user: { login: 'x' }, message: { text: '' } });
    clients[0].emit('message', { user: {}, message: { text: 'nobody' } });
    expect(events.onMessage).toHaveBeenCalledTimes(1);
    expect(events.onMessage).toHaveBeenCalledWith({
      user: 'login',
      color: undefined,
      text: 'hey',
      emotes: [],
    });
  });

  it('reports the room id', () => {
    const { source, events, clients } = setup();
    source.setChannel('abc');
    clients[0].emit('roomState', { tags: { roomId: '77' } });
    expect(events.onRoomId).toHaveBeenCalledWith('77');
  });

  it('closes the old client and ignores its late events on a channel change', () => {
    const { source, events, clients } = setup();
    source.setChannel('abc');
    source.setChannel('def');
    expect(clients[0].client.close).toHaveBeenCalled();
    clients[0].emit('message', {
      user: { display: 'old' },
      message: { text: 'stale' },
    });
    expect(events.onMessage).not.toHaveBeenCalled();
    expect(events.onRoomId).toHaveBeenCalledWith(undefined);
  });

  it('goes idle for an empty channel', () => {
    const { source, events, clients, create } = setup();
    source.setChannel('abc');
    source.setChannel('');
    expect(clients[0].client.close).toHaveBeenCalled();
    expect(events.onStatus).toHaveBeenLastCalledWith('off');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect for the same channel', () => {
    const { source, create } = setup();
    source.setChannel('abc');
    source.setChannel('abc');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
