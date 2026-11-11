import { BadRequestException, Inject } from '@nestjs/common';

import { GetIncomesInput, GetIncomesSchema } from '@investment/application/dto/Income';
import {
  IncomeView,
  loadReadableAsset,
  toIncomeView,
} from '@investment/application/service/IncomeRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { narrowOwners, OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { addDays } from '@investment/domain/service/MarketDate';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const MAX_PERIOD_DAYS = 731;

export interface IncomeListResult {
  items: IncomeView[];
  nextCursor: null | string;
  summary?: IncomeListSummary;
}
export interface IncomeListSummary {
  currency: string;
  pendingSuggestions: number;
  plannedTotal: number;
  receivedThisYear: number;
}

export function decodeCursor(cursor: string): { id: string; paymentDate: string } {
  try {
    const [paymentDate, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate ?? '') || !id) {
      throw new Error('bad cursor');
    }

    return { id, paymentDate };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}
export function encodeCursor(income: { id: string; paymentDate: string }): string {
  return Buffer.from(`${income.paymentDate}|${income.id}`, 'utf8').toString('base64url');
}

// Spec 107 FR 32-34: keyset pages of one asset, or of every readable asset for a period (at most 2 years).
export class GetIncomesUseCase implements UseCaseWithParams<GetIncomesInput, IncomeListResult> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: GetIncomesInput): Promise<IncomeListResult> {
    const input = validate(GetIncomesSchema, params);

    if (!input.assetId && (!input.from || !input.to)) {
      throw new BadRequestException('Send an assetId or a period (from and to)');
    }
    if (input.from && input.to && input.to > addDays(input.from, MAX_PERIOD_DAYS)) {
      throw new BadRequestException('The period can have at most 2 years');
    }

    const asset = input.assetId
      ? await loadReadableAsset(this.investment, input.assetId, input.accessibleOwners)
      : undefined;
    const rows = await this.incomes.findIncomes({
      assetId: asset?.id,
      cursor: input.cursor ? decodeCursor(input.cursor) : undefined,
      from: input.from,
      limit: input.limit + 1,
      owners: this.owners(input),
      status: input.status,
      to: input.to,
      type: input.type,
    });
    const page = rows.slice(0, input.limit);
    const last = page[page.length - 1];
    const today = todayInSaoPaulo();

    return {
      items: page.map((income) => toIncomeView(income, today)),
      nextCursor: rows.length > input.limit && last ? encodeCursor(last) : null,
      ...(asset ? { summary: await this.summary(asset.id, asset.currency, today) } : {}),
    };
  }

  private owners(input: ReturnType<typeof GetIncomesSchema.parse>): OwnerAccess[] {
    const narrowed = narrowOwners(input.accessibleOwners, input.ownerId);

    return input.owner && input.owner !== 'ALL'
      ? narrowed.filter((access) => access.owner === input.owner)
      : narrowed;
  }

  private async summary(
    assetId: string,
    currency: string,
    today: string,
  ): Promise<IncomeListSummary> {
    const year = today.slice(0, 4);
    const [totals, pendingSuggestions] = await Promise.all([
      this.incomes.incomeTotals(assetId, `${year}-01-01`, `${year}-12-31`),
      this.incomes.countPendingSuggestions(assetId),
    ]);

    return {
      currency,
      pendingSuggestions,
      plannedTotal: totals.planned,
      receivedThisYear: totals.received,
    };
  }
}
