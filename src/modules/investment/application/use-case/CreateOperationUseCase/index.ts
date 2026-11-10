import { Inject } from '@nestjs/common';

import {
  CreateOperationInput,
  CreateOperationSchema,
} from '@investment/application/dto/OperationInput';
import {
  loadWritableAsset,
  OperationWriteResult,
  persistOperation,
} from '@investment/application/service/OperationRules';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 9-14, 19: a buy or sell with its fees and, optionally, the linked finance row.
export class CreateOperationUseCase implements UseCaseWithParams<
  CreateOperationInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: CreateOperationInput): Promise<OperationWriteResult> {
    const input = validate(CreateOperationSchema, params);
    const asset = await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    return persistOperation(this.repository, {
      accountId: input.accountId ?? null,
      asset,
      date: input.date,
      fees: input.fees,
      generateTransaction: input.generateTransaction,
      owners: input.accessibleOwners,
      quantity: input.quantity,
      type: input.type,
      unitPrice: input.unitPrice,
    });
  }
}
