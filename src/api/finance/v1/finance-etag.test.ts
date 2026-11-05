import { ExecutionContext } from '@nestjs/common';

import { FinanceAccessService, resolvedAccessStore } from '@api/finance/v1/finance-access.service';
import { FinanceEtagGuard, FinanceEtagInterceptor } from '@api/finance/v1/finance-etag';
import { GetOwnerDataVersionsUseCase } from '@finance/application/use-case/GetOwnerDataVersionsUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { NotModifiedException } from '@shared/infra/http/not-modified';
import { lastValueFrom, valueStream } from '@shared/infra/http/request-context';

jest.useFakeTimers({ now: new Date('2026-11-05T12:00:00Z') });

const userId = 'user-id';
const familyId = 'family-id';
const owners = [
  { owner: OwnerType.USER, ownerId: userId },
  { archived: false, owner: OwnerType.FAMILY, ownerId: familyId },
];

const response = { setHeader: jest.fn() };
let request: Record<string, unknown>;

function contextOf(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

const accessMock = {
  resolveWithNames: jest.fn(),
};
const versionsMock = { execute: jest.fn() };
const guard = new FinanceEtagGuard(
  accessMock as unknown as FinanceAccessService,
  versionsMock as unknown as GetOwnerDataVersionsUseCase,
);

function newRequest(overrides: Record<string, unknown> = {}) {
  request = {
    headers: {},
    method: 'GET',
    originalUrl: '/api/v1/finance/month?month=2026-11',
    path: '/api/v1/finance/month',
    query: { month: '2026-11' },
    user: { id: userId },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  newRequest();
  accessMock.resolveWithNames.mockResolvedValue({
    accessibleOwners: owners,
    familyNames: { [familyId]: 'Casa' },
  });
  versionsMock.execute.mockResolvedValue([3, 1]);
});

async function etagOf(): Promise<string> {
  await guard.canActivate(contextOf());

  return (request.financeEtag as { etag: string }).etag;
}

describe('GIVEN FinanceEtagGuard', () => {
  it('SHOULD let a non-GET request through WITHOUT reading anything', async () => {
    newRequest({ method: 'POST' });

    expect(await guard.canActivate(contextOf())).toBe(true);
    expect(accessMock.resolveWithNames).not.toHaveBeenCalled();
    expect(versionsMock.execute).not.toHaveBeenCalled();
  });

  it('SHOULD read the versions of ALL the accessible owners WHEN there is no ownerId AND let the request run', async () => {
    expect(await guard.canActivate(contextOf())).toBe(true);

    expect(versionsMock.execute).toHaveBeenCalledWith(owners);
    expect(request.financeEtag).toMatchObject({ dataVersion: '3-1' });
  });

  it('SHOULD read only the requested owners WHEN ownerId is given (a write of another owner keeps the ETag)', async () => {
    newRequest({ query: { ownerId: userId } });
    versionsMock.execute.mockResolvedValue([3]);

    await guard.canActivate(contextOf());

    expect(versionsMock.execute).toHaveBeenCalledWith([owners[0]]);
  });

  it('SHOULD drop an ownerId the caller cannot access (never reads its version)', async () => {
    newRequest({ query: { ownerId: ['other-family', userId] } });
    versionsMock.execute.mockResolvedValue([3]);

    await guard.canActivate(contextOf());

    expect(versionsMock.execute).toHaveBeenCalledWith([owners[0]]);
  });

  it('SHOULD leave a malformed ownerId to the handler validation', async () => {
    newRequest({ query: { ownerId: { a: 'b' } } });

    expect(await guard.canActivate(contextOf())).toBe(true);
    expect(versionsMock.execute).not.toHaveBeenCalled();
    expect(request.financeEtag).toBeUndefined();
  });

  it('SHOULD answer 304 with the validators AND no use case WHEN If-None-Match matches', async () => {
    const etag = await etagOf();

    newRequest({ headers: { 'if-none-match': etag } });

    await expect(guard.canActivate(contextOf())).rejects.toBeInstanceOf(NotModifiedException);
    expect(response.setHeader).toHaveBeenCalledWith('ETag', etag);
    expect(response.setHeader).toHaveBeenCalledWith('X-Data-Version', '3-1');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
  });

  it('SHOULD let the request run WHEN a write of the owner changed the version', async () => {
    const etag = await etagOf();

    newRequest({ headers: { 'if-none-match': etag } });
    versionsMock.execute.mockResolvedValue([4, 1]);

    expect(await guard.canActivate(contextOf())).toBe(true);
    expect((request.financeEtag as { etag: string }).etag).not.toBe(etag);
  });

  it('SHOULD change the ETag WHEN a new day starts', async () => {
    const etag = await etagOf();

    jest.setSystemTime(new Date('2026-11-06T12:00:00Z'));
    newRequest();

    expect(await etagOf()).not.toBe(etag);
  });

  it('SHOULD make the owners resolution fail the request (no ETag from a partial read)', async () => {
    accessMock.resolveWithNames.mockRejectedValue(new Error('db down'));

    await expect(guard.canActivate(contextOf())).rejects.toThrow('db down');
  });
});

describe('GIVEN FinanceEtagInterceptor', () => {
  const interceptor = new FinanceEtagInterceptor();

  it('SHOULD pass through WHEN the guard stored no state', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextOf(), { handle: () => valueStream('body') }),
    );

    expect(result).toBe('body');
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('SHOULD run the handler inside the resolved access AND send the ETag chosen before the work', async () => {
    await guard.canActivate(contextOf());
    const { etag } = request.financeEtag as { etag: string };
    let seen: unknown;

    const result = await lastValueFrom(
      interceptor.intercept(contextOf(), {
        handle: () => {
          seen = resolvedAccessStore.get();

          return valueStream('body');
        },
      }),
    );

    expect(result).toBe('body');
    expect(seen).toMatchObject({ accessibleOwners: owners, userId });
    expect(response.setHeader).toHaveBeenCalledWith('ETag', etag);
    expect(response.setHeader).toHaveBeenCalledWith('X-Data-Version', '3-1');
  });

  it('SHOULD NOT send an ETag WHEN the handler fails', async () => {
    await guard.canActivate(contextOf());

    await expect(
      lastValueFrom(
        interceptor.intercept(contextOf(), {
          handle: () => {
            throw new Error('boom');
          },
        }),
      ),
    ).rejects.toThrow('boom');
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
