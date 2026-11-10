import { Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateOperationInput,
  UpdateOperationSchema,
} from '@investment/application/dto/OperationInput';
import {
  assertLinkedAccountChangeable,
  loadWritableAsset,
  OperationWriteResult,
  persistOperation,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 18, 21: every field but the asset and the type; the finance row follows in the same transaction.
export class UpdateOperationUseCase implements UseCaseWithParams<
  UpdateOperationInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly context: QuoteContextLoader,
  ) {}

  async execute(params: UpdateOperationInput): Promise<OperationWriteResult> {
    const input = validate(UpdateOperationSchema, params);
    const operation = await this.repository.findOperationById(input.id);
    const found = operation ? await this.repository.findAssetById(operation.assetId) : undefined;

    if (!operation || !found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    const asset = await loadWritableAsset(this.repository, found.id, input.accessibleOwners);

    await assertLinkedAccountChangeable(
      this.repository,
      input.accessibleOwners,
      operation.accountId,
    );

    const generateTransaction = input.generateTransaction ?? operation.generateTransaction;
    const accountId = generateTransaction ? (input.accountId ?? operation.accountId) : null;

    if (generateTransaction && !accountId) {
      throw new ValidationError([
        {
          code: 'custom',
          field: 'accountId',
          message: 'accountId is required when generating a finance entry',
        },
      ]);
    }

    return persistOperation(this.repository, {
      accountId,
      asset,
      context: await this.context.load([asset]),
      date: input.date ?? operation.date,
      fees:
        input.fees ??
        operation.fees.map((fee) => ({
          amount: fee.amount,
          description: fee.description,
          kind: fee.kind,
        })),
      fxRate: input.fxRate === undefined ? operation.fxRate : input.fxRate,
      generateTransaction,
      operationId: operation.id,
      owners: input.accessibleOwners,
      quantity: input.quantity ?? operation.quantity,
      type: operation.type,
      unitPrice: input.unitPrice ?? operation.unitPrice,
    });
  }
}
