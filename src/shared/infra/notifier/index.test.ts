import { PgNotifier } from './index';
import { client, clientHandlers, env, logger } from './index.mocks';

jest.mock('pg', () => ({ Client: jest.fn(() => jest.requireActual('./index.mocks').client) }));

let notifier: PgNotifier;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  notifier = new PgNotifier(env, logger);
});
afterEach(() => jest.useRealTimers());

describe('subscribe', () => {
  it('SHOULD listen once per channel AND deliver the payload to every handler', async () => {
    const first = jest.fn();
    const second = jest.fn();

    await notifier.subscribe('stock_list_events', first);
    await notifier.subscribe('stock_list_events', second);
    clientHandlers.notification({ channel: 'stock_list_events', payload: '{"id":1}' });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('LISTEN stock_list_events');
    expect(first).toHaveBeenCalledWith('{"id":1}');
    expect(second).toHaveBeenCalledWith('{"id":1}');
  });

  it('SHOULD stop delivering after the unsubscribe AND ignore other channels', async () => {
    const handler = jest.fn();
    const stop = await notifier.subscribe('stock_list_events', handler);

    stop();
    clientHandlers.notification({ channel: 'stock_list_events', payload: 'x' });
    clientHandlers.notification({ channel: 'other', payload: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a channel name that is not a plain identifier', async () => {
    await expect(notifier.subscribe('a; DROP', jest.fn())).rejects.toThrow('Invalid channel name');
  });
});

describe('connection loss', () => {
  it('SHOULD reconnect and listen again to the channels in use', async () => {
    await notifier.subscribe('stock_list_events', jest.fn());
    client.query.mockClear();

    clientHandlers.end();
    await jest.advanceTimersByTimeAsync(5000);

    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenCalledWith('LISTEN stock_list_events');
    expect(logger.log).toHaveBeenCalled();
  });

  it('SHOULD try again WHEN the reconnect fails AND stop after the module is destroyed', async () => {
    await notifier.subscribe('stock_list_events', jest.fn());
    client.connect.mockRejectedValueOnce(new Error('down'));

    clientHandlers.error(new Error('boom'));
    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);

    expect(client.connect).toHaveBeenCalledTimes(3);

    await notifier.onModuleDestroy();
    expect(client.end).toHaveBeenCalled();
  });
});
