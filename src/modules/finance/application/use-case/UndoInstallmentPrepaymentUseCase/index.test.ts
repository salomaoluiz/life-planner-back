import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD undo the prepayment of the plan', async () => {
  await setup.execute(mocks.input);

  expect(mocks.prepaymentRepository.undoPrepayment).toHaveBeenCalledWith(mocks.input.id);
});

it('SHOULD answer 404 WHEN the plan is missing or not accessible', async () => {
  mocks.planRepository.findPlanById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
  expect(mocks.prepaymentRepository.undoPrepayment).not.toHaveBeenCalled();
});
