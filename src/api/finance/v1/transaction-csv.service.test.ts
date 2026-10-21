import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TransactionCsvService } from '@api/finance/v1/transaction-csv.service';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { CountExportTransactionsUseCase } from '@finance/application/use-case/CountExportTransactionsUseCase';
import { ExportTransactionsUseCase } from '@finance/application/use-case/ExportTransactionsUseCase';
import { ImportTransactionsUseCase } from '@finance/application/use-case/ImportTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
const mocks = {
  access: { resolve: jest.fn().mockResolvedValue(owners) },
  count: { execute: jest.fn().mockResolvedValue({ count: 3 }) },
  export: { execute: jest.fn().mockResolvedValue({ csv: 'x', filename: 'f.csv' }) },
  families: { execute: jest.fn().mockResolvedValue([{ id: 'family-1', name: 'Família Exemplo' }]) },
  importRows: { execute: jest.fn().mockResolvedValue({ created: 2, duplicates: [], errors: [] }) },
  materialize: { execute: jest.fn().mockResolvedValue(undefined) },
};
const request = {
  from: '2026-01-01',
  owner: 'ALL' as const,
  to: '2026-12-31',
  today: '2026-10-21',
};

async function build() {
  const module = await Test.createTestingModule({
    providers: [
      TransactionCsvService,
      { provide: CountExportTransactionsUseCase, useValue: mocks.count },
      { provide: ExportTransactionsUseCase, useValue: mocks.export },
      { provide: FinanceAccessService, useValue: mocks.access },
      { provide: GetUserFamiliesUseCase, useValue: mocks.families },
      { provide: ImportTransactionsUseCase, useValue: mocks.importRows },
      { provide: MaterializeRecurrencesUseCase, useValue: mocks.materialize },
    ],
  }).compile();

  return module.get(TransactionCsvService);
}

it('SHOULD materialize recurrences, then count with the repeated ids as lists', async () => {
  const setup = await build();

  const result = await setup.count('user-1', { ...request, accountId: 'a1' });

  expect(result).toEqual({ count: 3 });
  expect(mocks.materialize.execute).toHaveBeenCalledWith({
    accessibleOwners: owners,
    today: '2026-10-21',
  });
  expect(mocks.count.execute).toHaveBeenCalledWith(
    expect.objectContaining({ accessibleOwners: owners, accountIds: ['a1'], from: '2026-01-01' }),
  );
});

it('SHOULD export with the family names resolved here, not by the finance module', async () => {
  const setup = await build();

  await setup.export('user-1', { ...request, format: 'BR', lang: 'pt-BR' });

  expect(mocks.export.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      format: 'BR',
      ownerNames: { 'family-1': 'Família Exemplo' },
      today: '2026-10-21',
    }),
  );
});

it('SHOULD import with the owners of the caller and the client day', async () => {
  const setup = await build();
  const input = { dryRun: false, owner: 'USER', ownerId: 'user-1', rows: [] } as never;

  expect(await setup.import('user-1', input, '2026-10-21')).toEqual({
    created: 2,
    duplicates: [],
    errors: [],
  });
  expect(mocks.importRows.execute).toHaveBeenCalledWith(
    expect.objectContaining({ accessibleOwners: owners, today: '2026-10-21' }),
  );
});
