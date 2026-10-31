import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { UpcomingService } from '@api/finance/v1/upcoming.service';
import { GetUpcomingItemsUseCase } from '@finance/application/use-case/GetUpcomingItemsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
const request = { days: 7, limit: 5, ownerIds: ['user-1'], today: '2026-11-12' };
const calls: string[] = [];
const accessMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const materializeMock = {
  execute: jest.fn().mockImplementation(async () => {
    calls.push('materialize');
  }),
};
const upcomingMock = {
  execute: jest.fn().mockImplementation(async () => {
    calls.push('upcoming');

    return { next: [] };
  }),
};

it('SHOULD materialize the due recurrences BEFORE reading the upcoming items', async () => {
  const module = await Test.createTestingModule({
    providers: [
      UpcomingService,
      { provide: FinanceAccessService, useValue: accessMock },
      { provide: GetUpcomingItemsUseCase, useValue: upcomingMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeMock },
    ],
  }).compile();

  const result = await module.get(UpcomingService).getUpcoming('user-1', request);

  expect(calls).toEqual(['materialize', 'upcoming']);
  expect(materializeMock.execute).toHaveBeenCalledWith({
    accessibleOwners,
    ownerIds: ['user-1'],
    today: '2026-11-12',
  });
  expect(upcomingMock.execute).toHaveBeenCalledWith({ ...request, accessibleOwners });
  expect(result).toEqual({ next: [] });
});
