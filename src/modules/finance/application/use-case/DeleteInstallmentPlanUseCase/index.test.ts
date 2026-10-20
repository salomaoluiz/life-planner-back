import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete the whole plan', async () => {
  await setup.execute(mocks.input);

  expect(mocks.planRepository.deletePlan).toHaveBeenCalledWith(mocks.input.id);
});

it('SHOULD answer 404 WHEN the plan is missing or not accessible', async () => {
  mocks.planRepository.findPlanById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
  expect(mocks.planRepository.deletePlan).not.toHaveBeenCalled();
});

it('SHOULD let the paid-invoice 422 through', async () => {
  mocks.planRepository.deletePlan.mockRejectedValueOnce(new UnprocessableEntityException());

  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD answer 422 WHEN the plan has refunds AND delete nothing', async () => {
  mocks.cardCreditRepository.countRefundsByPlanId.mockResolvedValueOnce(2);

  await expect(setup.execute(mocks.input)).rejects.toThrow('Delete its refunds first');
  expect(mocks.planRepository.deletePlan).not.toHaveBeenCalled();
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = mocks.input;
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
