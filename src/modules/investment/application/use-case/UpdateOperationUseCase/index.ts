import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';

import { EventShapeSchema } from '@investment/application/dto/EventInput';
import {
  UpdateOperationInput,
  UpdateOperationSchema,
} from '@investment/application/dto/OperationInput';
import { persistEvent } from '@investment/application/service/EventRules';
import {
  assertRatesCoverContributions,
  contributionDatesOf,
  detailViewOf,
  findCalculatedData,
  mapFixedIncomeErrors,
  principalOf,
} from '@investment/application/service/FixedIncomeRules';
import {
  assertLinkedAccountChangeable,
  loadWritableAsset,
  OperationWriteResult,
  persistOperation,
  resolveOperationAccount,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentOperationType, isEventType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { fractionUnitPrice } from '@investment/domain/service/CorporateEventMath';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';
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

    if (isEventType(operation.type)) {
      return this.updateEvent(input, operation, asset);
    }

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

    const calculated = await findCalculatedData(this.repository, asset);

    if (calculated) {
      return this.updateCalculated(input, operation, asset, calculated, {
        accountId,
        generateTransaction,
      });
    }

    if (input.amount !== undefined || input.netAmount !== undefined || input.kind !== undefined) {
      throw fieldsNotAllowed(['amount', 'kind', 'netAmount']);
    }

    if (operation.fractionOfOperationId) {
      return this.updateFractionSale(input, operation, asset, { accountId, generateTransaction });
    }

    if (input.grossAmount !== undefined || hasEventFields(input)) {
      throw fieldsNotAllowed([
        'grossAmount',
        'bonusPercent',
        'bonusUnitCost',
        'ratioFrom',
        'ratioTo',
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

  // Spec 108 FR 20: the date and the fields of its own type; nothing of a buy or a sell.
  private async updateEvent(
    input: z.output<typeof UpdateOperationSchema>,
    operation: OperationEntity,
    asset: AssetDetail,
  ): Promise<OperationWriteResult> {
    const sent = [
      'accountId',
      'amount',
      'fees',
      'fxRate',
      'generateTransaction',
      'grossAmount',
      'kind',
      'netAmount',
      'quantity',
      'unitPrice',
    ].filter((field) => input[field as keyof typeof input] !== undefined);

    if (sent.length > 0) {
      throw fieldsNotAllowed(sent);
    }

    const stored = operation.event;
    const bonus = stored?.kind === 'BONUS' ? stored : null;
    const split = stored?.kind === 'SPLIT' ? stored : null;
    const merged = validate(EventShapeSchema, {
      bonusPercent: input.bonusPercent ?? bonus?.percent ?? null,
      bonusUnitCost:
        input.bonusUnitCost === undefined ? (bonus?.unitCost ?? null) : input.bonusUnitCost,
      ratioFrom: input.ratioFrom ?? split?.ratioFrom ?? null,
      ratioTo: input.ratioTo ?? split?.ratioTo ?? null,
      type: operation.type,
    });

    return persistEvent(
      this.repository,
      asset,
      {
        assetId: asset.id,
        bonusPercent: merged.bonusPercent ?? null,
        bonusUnitCost: merged.bonusUnitCost ?? null,
        date: input.date ?? operation.date,
        operationId: operation.id,
        ratioFrom: merged.ratioFrom ?? null,
        ratioTo: merged.ratioTo ?? null,
        type: operation.type,
      },
      await this.context.load([asset]),
    );
  }

  // Spec 108 FR 19: date, amount, fees and the finance link; the quantity is the event's fraction and never changes here.
  private async updateFractionSale(
    input: z.output<typeof UpdateOperationSchema>,
    operation: OperationEntity,
    asset: AssetDetail,
    link: { accountId: null | string; generateTransaction: boolean },
  ): Promise<OperationWriteResult> {
    const sent = ['quantity', 'unitPrice', 'fxRate'].filter(
      (field) => input[field as keyof typeof input] !== undefined,
    );

    if (sent.length > 0 || hasEventFields(input)) {
      throw fieldsNotAllowed([...sent, 'bonusPercent', 'bonusUnitCost', 'ratioFrom', 'ratioTo']);
    }

    const event = asset.operations.find((item) => item.id === operation.fractionOfOperationId);
    const date = input.date ?? operation.date;
    const gross = input.grossAmount ?? operation.gross;

    if (event && date < event.date) {
      throw new UnprocessableEntityException('The fraction sale cannot be dated before the event');
    }
    if (link.generateTransaction && gross === 0) {
      throw new ValidationError([
        {
          code: 'custom',
          field: 'grossAmount',
          message: 'grossAmount must be greater than zero when generating a finance entry',
        },
      ]);
    }

    return persistOperation(this.repository, {
      accountId: link.accountId,
      asset,
      context: await this.context.load([asset]),
      date,
      fees:
        input.fees ??
        operation.fees.map((fee) => ({
          amount: fee.amount,
          description: fee.description,
          kind: fee.kind,
        })),
      fractionOfOperationId: operation.fractionOfOperationId ?? undefined,
      generateTransaction: link.generateTransaction,
      grossCents: gross,
      operationId: operation.id,
      owners: input.accessibleOwners,
      quantity: operation.quantity,
      type: operation.type,
      unitPrice: fractionUnitPrice(gross, operation.quantity),
    });
  }

  // Spec 105 section 7: a calculated title accepts only the fixed income shape; the recalculation runs in the write.
  private async updateCalculated(
    input: z.output<typeof UpdateOperationSchema>,
    operation: OperationEntity,
    asset: AssetDetail,
    calculated: NonNullable<Awaited<ReturnType<typeof findCalculatedData>>>,
    link: { accountId: null | string; generateTransaction: boolean },
  ): Promise<OperationWriteResult> {
    if (
      input.quantity !== undefined ||
      input.unitPrice !== undefined ||
      input.fees !== undefined ||
      input.fxRate !== undefined
    ) {
      throw fieldsNotAllowed(['fees', 'fxRate', 'quantity', 'unitPrice']);
    }

    const date = input.date ?? operation.date;
    const isBuy = operation.type === InvestmentOperationType.BUY;

    if (isBuy) {
      if (date > calculated.terms.maturityDate) {
        throw new UnprocessableEntityException('A contribution cannot be dated after the maturity');
      }

      assertRatesCoverContributions(
        calculated.rates.map((rate) => rate.startDate),
        [...contributionDatesOf(asset).filter((day) => day !== operation.date), date],
      );
    }

    if (link.generateTransaction && link.accountId) {
      await resolveOperationAccount(this.repository, input.accessibleOwners, link.accountId, 'BRL');
    }

    const amount = input.amount ?? operation.quantity.mulToCents(Decimal8.parse('1'));
    const netAmount = input.netAmount ?? operation.netAmount ?? operation.total;

    await mapFixedIncomeErrors(async () =>
      this.repository.writeOperation({
        accountId: link.accountId,
        assetId: asset.id,
        assetLabel: asset.name,
        currency: 'BRL',
        date,
        fees: [],
        feesTotal: 0,
        fxRate: null,
        generateTransaction: link.generateTransaction,
        gross: isBuy ? amount : 0,
        netAmount: isBuy ? null : netAmount,
        operationId: operation.id,
        quantity: isBuy ? principalOf(amount) : PLACEHOLDER_QUANTITY,
        redemptionKind: isBuy ? null : (input.kind ?? operation.redemptionKind),
        total: isBuy ? amount : netAmount,
        type: operation.type,
        unitPrice: Decimal8.parse('1'),
      }),
    );

    const detail = await detailViewOf(this.repository, this.context, asset.id);
    const view = detail.operations.find((item) => item.operation.id === operation.id);

    if (!view) {
      throw new NotFoundException();
    }

    return { asset: detail, operation: view };
  }
}

function hasEventFields(input: z.output<typeof UpdateOperationSchema>): boolean {
  return (
    input.bonusPercent !== undefined ||
    input.bonusUnitCost !== undefined ||
    input.ratioFrom !== undefined ||
    input.ratioTo !== undefined
  );
}

// The `quantity > 0` CHECK needs a value before the recalculation writes the principal consumed.
const PLACEHOLDER_QUANTITY = Decimal8.parse('0.01');

function fieldsNotAllowed(fields: string[]): ValidationError {
  return new ValidationError(
    fields.map((field) => ({
      code: 'custom',
      field,
      message: 'This field does not apply to this operation',
    })),
  );
}
