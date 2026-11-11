import { Inject, Injectable } from '@nestjs/common';

import { IncomeMapper } from '@investment/data/datasource/mapper/IncomeMapper';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { IIncomeDatasource } from '@investment/data/repository/datasource/IIncomeDatasource';
import {
  IncomeCategory,
  IncomeEntity,
  IncomeEventEntity,
  IncomeEventUpsert,
  IncomeFilter,
  IncomeSuggestionEntity,
  IncomeSuggestionInputs,
  IncomeSummaryTotals,
  NewSuggestionRow,
  WriteIncomeParams,
} from '@investment/domain/entity/IncomeEntity';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { IIncomeRepository } from '@investment/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

@Injectable()
export class IncomeRepository implements IIncomeRepository {
  constructor(
    @Inject('IIncomeDatasource')
    private readonly datasource: IIncomeDatasource,
  ) {}

  async countPendingSuggestions(assetId: string): Promise<number> {
    return this.datasource.countPendingSuggestions(assetId);
  }

  async createSuggestions(rows: NewSuggestionRow[]): Promise<number> {
    return this.datasource.createSuggestions(
      rows.map((row) => ({
        asset_id: row.assetId,
        event_id: row.eventId,
        quantity: row.quantity,
      })),
    );
  }

  async deleteIncome(id: string): Promise<void> {
    await this.datasource.deleteIncome(id);
  }

  async findCategoryById(id: string): Promise<IncomeCategory | undefined> {
    const row = await this.datasource.findCategoryById(id);

    return row ? IncomeMapper.toCategory(row) : undefined;
  }

  async findDefaultAccountId(assetId: string): Promise<string | undefined> {
    return (await this.datasource.findDefaultAccountId(assetId)) ?? undefined;
  }

  async findEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    sinceExDate: string,
  ): Promise<IncomeEventEntity[]> {
    const rows = await this.datasource.findEvents(
      keys,
      InvestmentMapper.fromCalendarDate(sinceExDate),
    );

    return rows.map((row) => IncomeMapper.toEvent(row));
  }

  async findIncomeById(id: string): Promise<IncomeEntity | undefined> {
    const row = await this.datasource.findIncomeById(id);

    return row ? IncomeMapper.toIncome(row) : undefined;
  }

  async findIncomeByTransactionId(
    transactionId: string,
  ): Promise<{ assetId: string; incomeId: string } | undefined> {
    const row = await this.datasource.findIncomeByTransactionId(transactionId);

    return row ? { assetId: row.asset_id, incomeId: row.id } : undefined;
  }

  async findIncomes(filter: IncomeFilter): Promise<IncomeEntity[]> {
    const rows = await this.datasource.findIncomes(filter);

    return rows.map((row) => IncomeMapper.toIncome(row));
  }

  async findLastIncomeCategoryId(
    owner: OwnerType,
    ownerId: string,
    type: InvestmentIncomeType,
  ): Promise<string | undefined> {
    return (await this.datasource.findLastIncomeCategoryId(owner, ownerId, type)) ?? undefined;
  }

  async findPendingSuggestions(assetIds: string[]): Promise<IncomeSuggestionEntity[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const rows = await this.datasource.findPendingSuggestions(assetIds);

    return rows.map((row) => IncomeMapper.toSuggestion(row));
  }

  async findSuggestionById(id: string): Promise<IncomeSuggestionEntity | undefined> {
    const row = await this.datasource.findSuggestionById(id);

    return row ? IncomeMapper.toSuggestion(row) : undefined;
  }

  async findSuggestionInputs(
    keys: { market: QuoteMarket; ticker: string }[],
  ): Promise<IncomeSuggestionInputs> {
    const row = await this.datasource.findSuggestionInputs(keys);

    return {
      assets: row.assets.map((asset) => ({
        assetId: asset.asset_id,
        market: QuoteMarket[asset.market as keyof typeof QuoteMarket],
        operations: asset.operations.map((operation) => ({
          createdAt: operation.created_at,
          date: InvestmentMapper.toCalendarDate(operation.date),
          id: operation.id,
          quantity: operation.quantity.toFixed(8),
          total: operation.total,
          type: operation.type,
        })),
        ticker: asset.ticker,
      })),
      existing: row.existing.map((item) => `${item.asset_id}:${item.event_id}`),
      incomes: row.incomes.map((income) => ({
        assetId: income.asset_id,
        exDate: income.ex_date ? InvestmentMapper.toCalendarDate(income.ex_date) : null,
        paymentDate: InvestmentMapper.toCalendarDate(income.payment_date),
        type: income.type as InvestmentIncomeType,
      })),
    };
  }

  async incomeTotals(
    assetId: string,
    yearFrom: string,
    yearTo: string,
  ): Promise<IncomeSummaryTotals> {
    return this.datasource.incomeTotals(
      assetId,
      InvestmentMapper.fromCalendarDate(yearFrom),
      InvestmentMapper.fromCalendarDate(yearTo),
    );
  }

  async rejectSuggestion(id: string, userId: string): Promise<void> {
    await this.datasource.rejectSuggestion(id, userId);
  }

  async runExclusive(key: number, fn: () => Promise<void>): Promise<boolean> {
    return this.datasource.runExclusive(key, fn);
  }

  async upsertEvents(rows: IncomeEventUpsert[]): Promise<IncomeEventEntity[]> {
    const events = await this.datasource.upsertEvents(rows);

    return events.map((event) => IncomeMapper.toEvent(event));
  }

  async writeIncome(params: WriteIncomeParams): Promise<string> {
    return this.datasource.writeIncome(params);
  }
}
