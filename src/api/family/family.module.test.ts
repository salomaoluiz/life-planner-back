import { FactoryProvider, Provider } from '@nestjs/common';

import { FamilyAPIModule } from '@api/family/family.module';
import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { HasStockItemsByOwnerUseCase } from '@stock/application/use-case/HasStockItemsByOwnerUseCase';

function checksProvider(): FactoryProvider {
  const providers = Reflect.getMetadata('providers', FamilyAPIModule) as Provider[];

  return providers.find(
    (provider) =>
      typeof provider === 'object' &&
      'provide' in provider &&
      provider.provide === FAMILY_OWNED_RECORDS_CHECKS,
  ) as FactoryProvider;
}

it('SHOULD register the finance AND stock checks in the family-delete guard', () => {
  const provider = checksProvider();
  const finance = { execute: jest.fn() };
  const stock = { execute: jest.fn() };

  expect(provider.inject).toEqual([HasFinanceDataByOwnerUseCase, HasStockItemsByOwnerUseCase]);
  expect(provider.useFactory(finance, stock)).toEqual([finance, stock]);
});
