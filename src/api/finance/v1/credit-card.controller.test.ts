import { mocks, setup } from './credit-card.controller.mocks';

const userId = mocks.request.user.id;
const createBody = {
  brand: 'VISA',
  closingDay: 31,
  color: '#3B5BDB',
  dueDay: 10,
  limit: 500000,
  owner: 'USER',
  ownerId: userId,
  title: 'Main card',
};

describe('create', () => {
  it('SHOULD validate the body (default status) AND call the service', async () => {
    const result = await setup.create(mocks.request, createBody as never);

    expect(mocks.creditCardService.create).toHaveBeenCalledWith(userId, {
      ...createBody,
      status: 'ACTIVE',
    });
    expect(result).toEqual(mocks.card);
  });

  it('SHOULD reject an invalid body without calling the service', async () => {
    await expect(
      setup.create(mocks.request, { ...createBody, closingDay: 40 } as never),
    ).rejects.toThrow();
    expect(mocks.creditCardService.create).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD normalize ownerId (string or array) AND pass the status', async () => {
    const ownerId = '6f1c0d7e-0000-4000-8000-000000000003';

    await setup.findAll(mocks.request as never, { ownerId, status: 'ACTIVE' });

    expect(mocks.creditCardService.findAll).toHaveBeenCalledWith(userId, [ownerId], 'ACTIVE');
  });

  it('SHOULD list everything WHEN no filter is given', async () => {
    await setup.findAll(mocks.request as never, {});

    expect(mocks.creditCardService.findAll).toHaveBeenCalledWith(userId, undefined, undefined);
  });

  it('SHOULD reject an unknown status', async () => {
    await expect(setup.findAll(mocks.request as never, { status: 'DELETED' })).rejects.toThrow();
  });
});

describe('findAllOverview', () => {
  it('SHOULD call the service with the normalized owner ids', async () => {
    await setup.findAllOverview(mocks.request as never, {});

    expect(mocks.creditCardService.findOverview).toHaveBeenCalledWith(userId, undefined, undefined);
  });

  it('SHOULD forward the client today', async () => {
    await setup.findAllOverview(mocks.request as never, { today: '2026-10-15' });

    expect(mocks.creditCardService.findOverview).toHaveBeenCalledWith(
      userId,
      undefined,
      '2026-10-15',
    );
  });
});

describe('findOne / update / delete', () => {
  it('SHOULD delegate findOne with the user id', async () => {
    await setup.findOne(mocks.request, mocks.card.id);

    expect(mocks.creditCardService.findOne).toHaveBeenCalledWith(userId, mocks.card.id);
  });

  it('SHOULD validate the patch (null allowed) AND delegate update', async () => {
    await setup.update(mocks.request, mocks.card.id, { paymentDay: null } as never);

    expect(mocks.creditCardService.update).toHaveBeenCalledWith(userId, mocks.card.id, {
      paymentDay: null,
    });
  });

  it('SHOULD reject an empty patch', async () => {
    await expect(setup.update(mocks.request, mocks.card.id, {} as never)).rejects.toThrow();
  });

  it('SHOULD delegate delete', async () => {
    await setup.delete(mocks.request, mocks.card.id);

    expect(mocks.creditCardService.delete).toHaveBeenCalledWith(userId, mocks.card.id);
  });
});

it('SHOULD declare overview before :id (otherwise "overview" is parsed as an id and answers 400)', () => {
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(setup));

  expect(proto.indexOf('findAllOverview')).toBeLessThan(proto.indexOf('findOne'));
});
