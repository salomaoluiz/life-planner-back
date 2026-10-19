import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { RecurrenceController } from './recurrence.controller';
import { mocks, setup } from './recurrence.controller.mocks';

const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const body = {
  accountId: id,
  categoryId: id,
  date: '2026-10-05',
  description: 'Rent',
  frequency: 'MONTHLY',
  owner: 'USER',
  ownerId: id,
  type: 'EXPENSE',
  value: 200000,
};

it('SHOULD be served at /finance/recurrences under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, RecurrenceController)).toBe('finance/recurrences');
  expect(Reflect.getMetadata(VERSION_METADATA, RecurrenceController)).toBe('1');
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user and today', async () => {
    const result = await setup.create(mocks.request, body as never, { today: '2026-10-17' });

    expect(mocks.service.create).toHaveBeenCalledWith(mocks.request.user.id, body, '2026-10-17');
    expect(result).toEqual(mocks.output);
  });

  it('SHOULD reject an invalid body without calling the service', async () => {
    await expect(
      setup.create(mocks.request, { ...body, frequency: 'DAILY' } as never, {}),
    ).rejects.toThrow(ValidationError);
    expect(mocks.service.create).not.toHaveBeenCalled();
  });
});

describe('reads', () => {
  it('SHOULD list with the filter AND owner ids', async () => {
    await setup.findAll(mocks.request, { accountId: id, ownerId: id, status: 'ACTIVE' });

    expect(mocks.service.findAll).toHaveBeenCalledWith(mocks.request.user.id, [id], {
      accountId: id,
      status: 'ACTIVE',
    });
  });

  it('SHOULD return one series', async () => {
    await setup.findOne(mocks.request, id, { today: '2026-10-17' });

    expect(mocks.service.findOne).toHaveBeenCalledWith(mocks.request.user.id, id, '2026-10-17');
  });
});

describe('writes', () => {
  it('SHOULD update (scope ALL)', async () => {
    await setup.update(mocks.request, id, { endDate: null } as never, {});

    expect(mocks.service.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      { endDate: null },
      undefined,
    );
  });

  it('SHOULD split AND answer 200', async () => {
    await setup.split(mocks.request, id, { occurrenceNumber: 5, value: 1 } as never, {});

    expect(mocks.service.split).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      { occurrenceNumber: 5, value: 1 },
      undefined,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, RecurrenceController.prototype.split)).toBe(200);
  });

  it('SHOULD materialize a projected occurrence', async () => {
    await setup.materializeOccurrence(
      mocks.request,
      id,
      7,
      { scope: 'ONLY_THIS', value: 5 } as never,
      {},
    );

    expect(mocks.service.materializeOccurrence).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      7,
      { scope: 'ONLY_THIS', value: 5 },
      undefined,
    );
  });
});

describe('deletes', () => {
  it('SHOULD delete an occurrence by scope AND answer 204', async () => {
    await setup.deleteOccurrence(mocks.request, id, 4, {
      confirmPaid: 'true',
      scope: 'THIS_AND_NEXT',
    });

    expect(mocks.service.deleteOccurrence).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      4,
      'THIS_AND_NEXT',
      true,
      undefined,
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, RecurrenceController.prototype.deleteOccurrence),
    ).toBe(204);
  });

  it('SHOULD require a valid scope to delete an occurrence', async () => {
    await expect(setup.deleteOccurrence(mocks.request, id, 4, {})).rejects.toThrow(ValidationError);
  });

  it('SHOULD delete the whole series AND return the counts', async () => {
    await setup.delete(mocks.request, id, { confirmPaid: 'true' });

    expect(mocks.service.delete).toHaveBeenCalledWith(mocks.request.user.id, id, true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, RecurrenceController.prototype.delete)).toBe(
      200,
    );
  });
});
