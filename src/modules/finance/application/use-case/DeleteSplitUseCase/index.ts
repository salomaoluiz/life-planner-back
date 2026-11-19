import { Inject } from '@nestjs/common';

import { SplitAccessInput, SplitAccessSchema } from '@finance/application/dto/SplitAccess';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import { IFinanceSplitRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 119 FR 20: removes the header and every part (a paid invoice refuses it in the datasource).
export class DeleteSplitUseCase implements UseCaseWithParams<SplitAccessInput, void> {
  constructor(
    @Inject(GetSplitUseCase)
    private readonly getSplitUseCase: GetSplitUseCase,
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
  ) {}

  async execute(params: SplitAccessInput): Promise<void> {
    const input = validate(SplitAccessSchema, params);
    const split = await this.getSplitUseCase.execute(input);

    ensureOwnerWritable(input.accessibleOwners, split);
    await this.splitRepository.deleteSplit(split.id);
  }
}
