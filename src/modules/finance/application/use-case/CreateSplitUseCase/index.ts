import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { CreateSplitInput, CreateSplitSchema } from '@finance/application/dto/CreateSplit';
import {
  applySplitRules,
  assertConvertible,
  loadWritableSource,
  resolveCategoryId,
} from '@finance/application/service/SplitGuard';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
  IFinanceSplitRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import {
  invoiceMonthOf,
  isPurchaseInvoiceAllowed,
} from '@finance/domain/service/InvoiceCalculator';
import { assertParts, assertTotal } from '@finance/domain/service/SplitRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 119 FR 6-17: one header and 2 to 50 parts, or a saved transaction converted into the first part.
export class CreateSplitUseCase implements UseCaseWithParams<CreateSplitInput, SplitEntity> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: CreateSplitInput): Promise<SplitEntity> {
    const input = validate(CreateSplitSchema, params);
    const parts = input.parts.map((part) => ({ ...part, categoryId: resolveCategoryId(part) }));
    const isCard = input.creditCardId !== undefined;

    if (isCard && input.paid !== undefined) {
      throw new UnprocessableEntityException('Card purchases follow their invoice');
    }
    applySplitRules(() => {
      assertParts(parts, { card: isCard });
      assertTotal(parts, input.total);
    });

    const source = await loadWritableSource(
      {
        accountRepository: this.accountRepository,
        creditCardRepository: this.creditCardRepository,
      },
      input,
    );
    const currency = (source.card ?? source.account)?.currency;

    if (input.currency !== undefined && input.currency !== currency) {
      throw new UnprocessableEntityException('Transaction currency must match the source currency');
    }
    // FR 8: the same checks as a transaction, once per distinct category and type.
    const pairs = new Map(parts.map((part) => [`${part.categoryId}|${part.type}`, part]));

    await Promise.all(
      [...pairs.values()].map(async (part) =>
        this.ensureConsistencyUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          accountId: input.accountId,
          allowSplitAdjustment: true,
          blockArchivedCategory: true,
          categoryId: part.categoryId,
          creditCardId: input.creditCardId,
          currency,
          owner: source.owner.owner,
          ownerId: source.owner.ownerId,
          type: part.type,
        }),
      ),
    );

    if (
      input.invoiceMonth !== undefined &&
      (!source.card ||
        !isPurchaseInvoiceAllowed(input.date, source.card.closingDay, input.invoiceMonth))
    ) {
      throw new UnprocessableEntityException('Invoice is not available for this date');
    }

    let sourceRow;

    if (input.fromTransactionId) {
      sourceRow = await this.transactionRepository.findTransactionById(input.fromTransactionId);
      if (!sourceRow || !hasOwnerAccess(input.accessibleOwners, sourceRow)) {
        throw new NotFoundException('Transaction not found');
      }
      assertConvertible(sourceRow);
      if (sourceRow.owner !== source.owner.owner || sourceRow.ownerId !== source.owner.ownerId) {
        throw new UnprocessableEntityException('The split belongs to another owner');
      }
    }

    return this.splitRepository.createSplit({
      accountId: input.accountId ?? null,
      createdBy: input.requesterId,
      creditCardId: input.creditCardId ?? null,
      currency: currency as NonNullable<typeof currency>,
      date: input.date,
      description: input.description,
      invoiceMonth: source.card
        ? (input.invoiceMonth ?? invoiceMonthOf(input.date, source.card.closingDay))
        : null,
      notes: input.notes ?? null,
      occurrenceNumber: sourceRow?.occurrenceNumber ?? null,
      owner: source.owner.owner,
      ownerId: source.owner.ownerId,
      paid: source.account ? (input.paid ?? input.date <= (input.today ?? input.date)) : null,
      parts: parts.map((part) => ({
        categoryId: part.categoryId,
        description: part.description ?? null,
        tags: part.tags,
        type: part.type,
        value: part.value,
      })),
      recurrenceId: sourceRow?.recurrenceId ?? null,
      sourceTransactionId: sourceRow?.id,
    });
  }
}
