import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { archivedOwners } from '@stock/application/mocks/stock.mocks';

import {
  captured,
  createdAt,
  gestureId,
  item,
  lot,
  mocks,
  movement,
  run,
  setup,
} from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, gestureId, userId: 'user-id' };
const soon = new Date(createdAt.getTime() + 60_000);

describe('execute', () => {
  it('SHOULD give the quantity of a CONSUME back and return the item view', async () => {
    run({ item: item([lot('a', 2)]), movements: [movement('a', -3)] });

    const view = await setup.execute({ ...base, now: soon });

    expect(captured.plan).toEqual({
      create: [],
      deleteLotIds: [],
      lotUpdates: [{ id: 'a', quantity: 5 }],
    });
    expect(view.item.id).toBe('item');
  });

  it('SHOULD answer 404 WHEN the user has no such gesture', async () => {
    mocks.stock.applyGestureChange.mockResolvedValue(undefined);

    await expect(setup.execute({ ...base, now: soon })).rejects.toThrow(NotFoundException);
  });

  it('SHOULD answer 409 "Não dá mais para desfazer" WHEN the window passed', async () => {
    run({ item: item([lot('a', 2)]), movements: [movement('a', -3)] });

    await expect(
      setup.execute({ ...base, now: new Date(createdAt.getTime() + 600_001) }),
    ).rejects.toThrow(new ConflictException('Não dá mais para desfazer'));
  });

  it('SHOULD answer 409 WHEN a later movement touched a lot', async () => {
    run({ item: item([lot('a', 2)]), laterLotIds: ['a'], movements: [movement('a', -3)] });

    await expect(setup.execute({ ...base, now: soon })).rejects.toThrow(ConflictException);
  });

  it('SHOULD answer 409 WHEN the reversal would leave a negative lot', async () => {
    run({ item: item([lot('a', 1)]), movements: [movement('a', 5, 'ENTRY' as never)] });

    await expect(setup.execute({ ...base, now: soon })).rejects.toThrow(ConflictException);
  });

  it('SHOULD refuse WHEN the family is archived (422) or the item is not readable (404)', async () => {
    run({ item: item([lot('a', 2)]), movements: [movement('a', -3)] });
    await expect(setup.execute({ ...base, accessibleOwners: [], now: soon })).rejects.toThrow(
      NotFoundException,
    );

    run({
      item: item([lot('a', 2)], (f) => f.withOwner('FAMILY' as never).withOwnerId('family-id')),
      movements: [movement('a', -3)],
    });
    await expect(
      setup.execute({ ...base, accessibleOwners: archivedOwners, now: soon }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
