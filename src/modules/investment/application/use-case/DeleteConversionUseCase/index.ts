import { Inject, NotFoundException } from '@nestjs/common';

import {
  ConversionAccessInput,
  ConversionAccessSchema,
} from '@investment/application/dto/ConversionInput';
import {
  assertNotLocked,
  toConversionException,
} from '@investment/application/service/ConversionWrite';
import { assertLinkedAccountChangeable } from '@investment/application/service/OperationRules';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 112 FR 19-20: both operations, the cash row, the fraction sale and its row go; the origin is active again.
export class DeleteConversionUseCase implements UseCaseWithParams<ConversionAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: ConversionAccessInput): Promise<void> {
    const input = validate(ConversionAccessSchema, params);
    const conversion = await this.repository.findConversionById(input.id);
    const origin = conversion ? await this.repository.findAssetById(conversion.fromAssetId) : null;
    const destination = conversion
      ? await this.repository.findAssetById(conversion.toAssetId)
      : null;

    if (!conversion || !origin || !destination || !hasOwnerAccess(input.accessibleOwners, origin)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, origin);
    assertNotLocked(conversion, conversion.toTicker ?? destination.name);

    const incoming = destination.operations.find(
      (operation) => operation.conversionId === conversion.id && operation.type === 'CONVERSION_IN',
    );
    const sale = destination.operations.find(
      (operation) => !!incoming && operation.fractionOfOperationId === incoming.id,
    );
    const accounts = [
      origin.operations.find((operation) => operation.conversionId === conversion.id)?.accountId,
      sale?.accountId,
    ];

    for (const accountId of accounts) {
      await assertLinkedAccountChangeable(
        this.repository,
        input.accessibleOwners,
        accountId ?? null,
      );
    }

    try {
      await this.repository.deleteConversion(conversion.id);
    } catch (error) {
      throw toConversionException(error);
    }
  }
}
