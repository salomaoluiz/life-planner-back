import { Inject } from '@nestjs/common';

import { GetRecurrencesInput, GetRecurrencesSchema } from '@finance/application/dto/GetRecurrences';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class GetRecurrencesUseCase implements UseCaseWithParams<
  GetRecurrencesInput,
  RecurrenceEntity[]
> {
  constructor(
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: GetRecurrencesInput): Promise<RecurrenceEntity[]> {
    const input = validate(GetRecurrencesSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    return this.recurrenceRepository.findByOwners(owners, {
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      status: input.status,
    });
  }
}
