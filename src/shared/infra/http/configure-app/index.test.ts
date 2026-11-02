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
});
