import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { TransactionCsvController } from '@api/finance/v1/transaction-csv.controller';
import { TransactionCsvService } from '@api/finance/v1/transaction-csv.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = {
  count: jest.fn().mockResolvedValue({ count: 12 }),
  export: jest.fn().mockResolvedValue({ csv: 'a;b', filename: 'transacoes-x.csv' }),
  import: jest.fn(),
};
const request = { user: { id: 'user-1' } } as never;
const query = { format: 'BR', from: '2026-01-01', lang: 'pt-BR', to: '2026-12-31' };

async function build() {
  const module = await Test.createTestingModule({
    controllers: [TransactionCsvController],
    providers: [{ provide: TransactionCsvService, useValue: serviceMock }],
  }).compile();

  return module.get(TransactionCsvController);
}

it('SHOULD be served at /finance/transactions under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, TransactionCsvController)).toBe('finance/transactions');
  expect(Reflect.getMetadata(VERSION_METADATA, TransactionCsvController)).toBe('1');
});

it('SHOULD return the csv and set the attachment filename', async () => {
  const setup = await build();
  const res = { setHeader: jest.fn() };

  const result = await setup.export(request, query, res);

  expect(result).toBe('a;b');
  expect(res.setHeader).toHaveBeenCalledWith(
    'Content-Disposition',
    'attachment; filename="transacoes-x.csv"',
  );
  expect(serviceMock.export).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ format: 'BR', from: '2026-01-01', owner: 'ALL', to: '2026-12-31' }),
  );
});

it('SHOULD refuse a missing from, a period over 2 years, and a family without ownerId', async () => {
  const setup = await build();
  const res = { setHeader: jest.fn() };

  await expect(setup.export(request, { ...query, from: undefined }, res)).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.export(request, { ...query, from: '2020-01-01' }, res)).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.export(request, { ...query, owner: 'FAMILY' }, res)).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD return the count of the same period', async () => {
  const setup = await build();

  expect(await setup.exportCount(request, query)).toEqual({ count: 12 });
  await expect(setup.exportCount(request, { to: '2026-12-31' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

describe('import', () => {
  const body = {
    dryRun: true,
    owner: 'USER',
    ownerId: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10',
    rows: [
      {
        accountId: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a11',
        categoryId: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a12',
        date: '2026-10-02',
        description: 'Supermercado',
        line: 2,
        type: 'EXPENSE',
        value: 31240,
      },
    ],
  };

  function response() {
    const json = jest.fn();

    return { json, res: { status: jest.fn().mockReturnValue({ json }) } };
  }

  it('SHOULD answer the dry run with 200, errors and duplicates only', async () => {
    const setup = await build();
    const { json, res } = response();

    serviceMock.import.mockResolvedValueOnce({ created: 0, duplicates: [2], errors: [] });

    await setup.import(request, body as never, { today: '2026-10-21' }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ duplicates: [2], errors: [] });
    expect(serviceMock.import).toHaveBeenCalledWith('user-1', expect.anything(), '2026-10-21');
  });

  it('SHOULD answer the real run with 201 and the created count', async () => {
    const setup = await build();
    const { json, res } = response();

    serviceMock.import.mockResolvedValueOnce({ created: 1, duplicates: [], errors: [] });

    await setup.import(request, { ...body, dryRun: false } as never, {}, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ created: 1 });
  });

  it('SHOULD refuse an empty rows list and more than 2,000 rows', async () => {
    const setup = await build();
    const { res } = response();
    const [row] = body.rows;

    await expect(
      setup.import(request, { ...body, rows: [] } as never, {}, res),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      setup.import(
        request,
        { ...body, rows: Array.from({ length: 2001 }, () => row) } as never,
        {},
        res,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
