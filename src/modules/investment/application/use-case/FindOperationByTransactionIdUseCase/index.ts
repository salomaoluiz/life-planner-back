import { Inject } from '@nestjs/common';

import {
  FindOperationByTransactionInput,
  FindOperationByTransactionSchema,
} from '@investment/application/dto/OperationInput';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 22: internal to the BFF; the finance row was already read with its own access check.
export class FindOperationByTransactionIdUseCase implements UseCaseWithParams<
  FindOperationByTransactionInput,
  { assetId: string; operationId: string } | undefined
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(
    params: FindOperationByTransactionInput,
  ): Promise<{ assetId: string; operationId: string } | undefined> {
    const input = validate(FindOperationByTransactionSchema, params);

    return this.repository.findOperationByTransactionId(input.transactionId);
  }
}
