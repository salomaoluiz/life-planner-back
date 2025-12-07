import { mocks, setup } from './health.controller.mocks';

describe('HealthController', () => {
  it('SHOULD return the health check result', async () => {
    const result = await setup.check();

    expect(result).toEqual(mocks.healthCheckResult);
  });

  it('SHOULD call healthCheckService.check with correct parameters', async () => {
    await setup.check();

    expect(mocks.healthCheckService.check).toHaveBeenCalledTimes(1);
    expect(mocks.healthCheckService.check).toHaveBeenCalledWith(expect.any(Array));
  });

  it('SHOULD call httpHealthIndicator.pingCheck with correct parameters inside the health check', async () => {
    await setup.check();

    expect(mocks.httpHealthIndicator.pingCheck).toHaveBeenCalledTimes(1);
    expect(mocks.httpHealthIndicator.pingCheck).toHaveBeenCalledWith(
      'nestjs-docs',
      'https://docs.nestjs.com',
    );
  });
});
