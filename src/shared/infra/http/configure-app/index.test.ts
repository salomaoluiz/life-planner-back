import { mocks, setup, spies } from './index.mocks';

describe('configureApp', () => {
  it('SHOULD apply cors, body limit, URI versioning, the api prefix and swagger', () => {
    setup();

    expect(spies.buildCorsOptions).toHaveBeenCalledWith(mocks.env.corsOrigins);
    expect(mocks.app.enableCors).toHaveBeenCalledWith(mocks.corsOptions);
    expect(mocks.app.useBodyParser).toHaveBeenCalledWith('json', { limit: '1mb' });
    expect(mocks.app.enableVersioning).toHaveBeenCalledWith({
      type: mocks.VersioningType.URI,
    });
    expect(mocks.app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(spies.setupSwagger).toHaveBeenCalledWith(mocks.app, true);
  });

  it('SHOULD skip CORS WHEN buildCorsOptions returns undefined', () => {
    spies.buildCorsOptions.mockReturnValue(undefined);

    setup();

    expect(mocks.app.enableCors).not.toHaveBeenCalled();
  });

  it('SHOULD NOT register the perf middleware WHEN the query counter is off', () => {
    setup();

    expect(mocks.app.use).not.toHaveBeenCalled();
  });

  describe('perf pool header (spec 069)', () => {
    function run(headers: Record<string, string>) {
      mocks.env.perfCountQueries = true;
      setup();
      const middleware = jest.mocked(mocks.app.use).mock.calls[0][0] as unknown as (
        req: unknown,
        res: unknown,
        next: () => void,
      ) => void;
      const writeHead = jest.fn();
      const res = { setHeader: jest.fn(), writeHead };
      const next = jest.fn();
      middleware({ headers }, res, next);
      // The value is read when the response head is written, after the handler ran.
      res.writeHead(200);

      return { next, res, writeHead };
    }

    afterEach(() => {
      mocks.env.perfCountQueries = false;
    });

    it('SHOULD expose the max pool waiting AND call next', () => {
      spies.poolMaxWaiting.mockReturnValue(4);

      const { next, res, writeHead } = run({});

      expect(res.setHeader).toHaveBeenCalledWith('x-perf-pool-max-waiting', '4');
      expect(writeHead).toHaveBeenCalledWith(200);
      expect(next).toHaveBeenCalledTimes(1);
      expect(spies.resetPool).not.toHaveBeenCalled();
    });

    it('SHOULD reset the pool max first WHEN x-perf-reset-pool is 1', () => {
      run({ 'x-perf-reset-pool': '1' });

      expect(spies.resetPool).toHaveBeenCalledTimes(1);
    });
  });
});
