import { Inject, NotFoundException } from '@nestjs/common';

import {
  OperationAccessInput,
  OperationAccessSchema,
} from '@investment/application/dto/OperationInput';
import { mapFixedIncomeErrors } from '@investment/application/service/FixedIncomeRules';
import {
  assertLinkedAccountChangeable,
  loadWritableAsset,
} from '@investment/application/service/OperationRules';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 21: deleting the operation deletes its finance row in the same transaction.
export class DeleteOperationUseCase implements UseCaseWithParams<OperationAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: OperationAccessInput): Promise<void> {
    const input = validate(OperationAccessSchema, params);
    const operation = await this.repository.findOperationById(input.id);
    const found = operation ? await this.repository.findAssetById(operation.assetId) : undefined;

    if (!operation || !found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    await loadWritableAsset(this.repository, found.id, input.accessibleOwners);
    await assertLinkedAccountChangeable(
      this.repository,
      input.accessibleOwners,
      operation.accountId,
    );

    await mapFixedIncomeErrors(async () => this.repository.deleteOperation(operation.id));
  }
}
