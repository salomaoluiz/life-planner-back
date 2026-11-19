import { Inject } from '@nestjs/common';
import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceSplitRepository, SplitSummary } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const GetSplitLookupsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  splitIds: z.array(z.string().min(1)),
});

export type GetSplitLookupsInput = z.input<typeof GetSplitLookupsSchema>;

// Spec 119 FR 27: the headers and totals of the splits a page of rows references, one read for the whole page.
export class GetSplitLookupsUseCase implements UseCaseWithParams<
  GetSplitLookupsInput,
  SplitSummary[]
> {
  constructor(
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
  ) {}

  async execute(params: GetSplitLookupsInput): Promise<SplitSummary[]> {
    const input = validate(GetSplitLookupsSchema, params);
    const summaries = await this.splitRepository.findSplitSummaries([...new Set(input.splitIds)]);

    return summaries.filter((summary) => hasOwnerAccess(input.accessibleOwners, summary));
  }
}
