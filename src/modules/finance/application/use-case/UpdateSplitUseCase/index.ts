import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { UpdateSplitInput, UpdateSplitSchema } from '@finance/application/dto/UpdateSplit';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import {
  applySplitRules,
  loadWritableSource,
  resolveCategoryId,
} from '@finance/application/service/SplitGuard';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import { SPLIT_FROM_STOCK_PURCHASE } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
  IFinanceSplitRepository,
} from '@finance/domain/repository';
import {
  invoiceMonthOf,
  isPurchaseInvoiceAllowed,
} from '@finance/domain/service/InvoiceCalculator';
import { assertParts, assertTotal } from '@finance/domain/service/SplitRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// `dissolved` is the ordinary transaction left when the write ended with one part (FR 22).
export interface UpdateSplitResult {
  dissolved?: TransactionEntity;
  split?: SplitEntity;
}

// Spec 119 FR 18, 19, 22: replaces the shared fields and the full list of parts, or only sets `paid`.
export class UpdateSplitUseCase implements UseCaseWithParams<UpdateSplitInput, UpdateSplitResult> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject(GetSplitUseCase)
    private readonly getSplitUseCase: GetSplitUseCase,
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
  ) {}

  async execute(params: UpdateSplitInput): Promise<UpdateSplitResult> {
    const input = validate(UpdateSplitSchema, params);
    const stored = await this.getSplitUseCase.execute(input);

    ensureOwnerWritable(input.accessibleOwners, stored);

    // Spec 120 FR 40: only `paid` (spec 097) stays allowed from finance on a purchase split.
    if (stored.stockPurchaseId !== null && !input.fromStockPurchase && input.parts !== undefined) {
      throw new UnprocessableEntityException(SPLIT_FROM_STOCK_PURCHASE);
    }

    if (input.parts === undefined) {
      if (stored.accountId === null) {
        throw new UnprocessableEntityException('Card purchases follow their invoice');
      }

      return { split: await this.splitRepository.setSplitPaid(stored.id, input.paid as boolean) };
    }

    const accountId = input.creditCardId
      ? undefined
      : (input.accountId ?? stored.accountId ?? undefined);
    const creditCardId = accountId
      ? undefined
      : (input.creditCardId ?? stored.creditCardId ?? undefined);
    const parts = input.parts.map((part) => ({ ...part, categoryId: resolveCategoryId(part) }));
    const isCard = creditCardId !== undefined;

    if (isCard && input.paid !== undefined) {
      throw new UnprocessableEntityException('Card purchases follow their invoice');
    }
    applySplitRules(() => {
      assertParts(parts, { card: isCard, minParts: 1 });
      assertTotal(parts, input.total);
    });

    const source = await loadWritableSource(
      {
        accountRepository: this.accountRepository,
        creditCardRepository: this.creditCardRepository,
      },
      { accessibleOwners: input.accessibleOwners, accountId, creditCardId },
    );

    if (source.owner.owner !== stored.owner || source.owner.ownerId !== stored.ownerId) {
      throw new UnprocessableEntityException('The split belongs to another owner');
    }
    const currency = (source.card ?? source.account)?.currency;
    const pairs = new Map(parts.map((part) => [`${part.categoryId}|${part.type}`, part]));

    await Promise.all(
      [...pairs.values()].map(async (part) =>
        this.ensureConsistencyUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          accountId,
          allowSplitAdjustment: true,
          // An untouched category may stay even if archived since (spec 041 FR 11).
          blockArchivedCategory: !stored.parts.some(
            (row) => row.categoryId === part.categoryId && row.type === part.type,
          ),
          categoryId: part.categoryId,
          creditCardId,
          currency,
          owner: source.owner.owner,
          ownerId: source.owner.ownerId,
          type: part.type,
        }),
      ),
    );

    const date = input.date ?? stored.date;

    if (
      source.card &&
      input.invoiceMonth !== undefined &&
      !isPurchaseInvoiceAllowed(date, source.card.closingDay, input.invoiceMonth)
    ) {
      throw new UnprocessableEntityException('Invoice is not available for this date');
    }

    // An unchanged card and date keep the stored invoice (it may have been chosen by hand, spec 095).
    const keepsInvoice = input.date === undefined && stored.creditCardId === creditCardId;
    const invoiceMonth = source.card
      ? (input.invoiceMonth ??
        (keepsInvoice ? stored.invoiceMonth : null) ??
        invoiceMonthOf(date, source.card.closingDay))
      : null;

    return this.splitRepository.updateSplit(stored.id, {
      accountId: accountId ?? null,
      createdBy: stored.createdBy,
      creditCardId: creditCardId ?? null,
      currency: currency as NonNullable<typeof currency>,
      date,
      description: input.description ?? stored.description,
      invoiceMonth,
      notes: input.notes === undefined ? stored.notes : input.notes,
      owner: stored.owner,
      ownerId: stored.ownerId,
      paid: source.account ? (input.paid ?? stored.paid ?? false) : null,
      parts: parts.map((part) => ({
        categoryId: part.categoryId,
        description: part.description ?? null,
        id: part.id,
        tags: part.tags,
        type: part.type,
        value: part.value,
      })),
    });
  }
}
