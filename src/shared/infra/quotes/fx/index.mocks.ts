import { EnvService } from '@shared/infra/env/env.service';

function envWith(brapiToken?: string) {
  return { brapiToken } as unknown as EnvService;
}

const mocks = {
  awesome: { USDBRL: { bid: '5.5601', timestamp: '1762272000' } },
  brapi: { currency: [{ bidPrice: '5.5599', updatedAtTimestamp: '1762272100' }] },
};

export { envWith, mocks };
