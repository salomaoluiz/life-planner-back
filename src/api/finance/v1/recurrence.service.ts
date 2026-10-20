import { Injectable } from '@nestjs/common';

import {
  CreateRecurrenceApiInput,
  MaterializeOccurrenceApiInput,
  SplitRecurrenceApiInput,
  UpdateRecurrenceApiInput,
} from '@api/finance/v1/dto/recurrence.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { toTransactionOutput } from '@api/finance/v1/transaction.service';
import { CreateRecurrenceUseCase } from '@finance/application/use-case/CreateRecurrenceUseCase';
import { DeleteOccurrenceUseCase } from '@finance/application/use-case/DeleteOccurrenceUseCase';
import { DeleteRecurrenceUseCase } from '@finance/application/use-case/DeleteRecurrenceUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { GetRecurrencesUseCase } from '@finance/application/use-case/GetRecurrencesUseCase';
import { GetRecurrenceUseCase } from '@finance/application/use-case/GetRecurrenceUseCase';
import { MaterializeOccurrenceUseCase } from '@finance/application/use-case/MaterializeOccurrenceUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { SplitRecurrenceUseCase } from '@finance/application/use-case/SplitRecurrenceUseCase';
import { UpdateRecurrenceUseCase } from '@finance/application/use-case/UpdateRecurrenceUseCase';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InstallmentEditScope, RecurrenceStatus } from '@finance/domain/enum';

function toProjectedOutput(item: ProjectedOccurrence) {
  return {
    account: item.account,
    category: item.category,
    creditCard: item.creditCard,
    currency: item.currency,
    date: item.date,
    description: item.description,
    frequency: item.frequency,
    invoiceListDate: item.invoiceListDate,
    invoiceMonth: item.invoiceMonth,
    occurrenceCount: item.occurrenceCount,
    occurrenceNumber: item.occurrenceNumber,
    owner: item.owner,
    ownerId: item.ownerId,
    recurrenceId: item.recurrenceId,
    type: item.type,
    value: item.value,
  };
}
function toRecurrenceOutput(series: RecurrenceEntity) {
  return {
    account: series.account,
    accountId: series.accountId,
    category: series.category,
    categoryId: series.categoryId,
    creditCard: series.creditCard,
    creditCardId: series.creditCardId,
    currency: series.currency,
    description: series.description,
    endDate: series.endDate,
    firstNumber: series.firstNumber,
    frequency: series.frequency,
    id: series.id,
    nextOccurrenceDate: series.nextOccurrenceDate,
    occurrenceCount: series.occurrenceCount,
    owner: series.owner,
    ownerId: series.ownerId,
    startDate: series.startDate,
    status: series.status,
    type: series.type,
    value: series.value,
  };
}

export { toProjectedOutput, toRecurrenceOutput };

@Injectable()
export class RecurrenceService {
  constructor(
    private readonly createRecurrenceUseCase: CreateRecurrenceUseCase,
    private readonly deleteOccurrenceUseCase: DeleteOccurrenceUseCase,
    private readonly deleteRecurrenceUseCase: DeleteRecurrenceUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
    private readonly getRecurrencesUseCase: GetRecurrencesUseCase,
    private readonly getRecurrenceUseCase: GetRecurrenceUseCase,
    private readonly materializeOccurrenceUseCase: MaterializeOccurrenceUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
    private readonly resolveCardRowsPaidUseCase: ResolveCardRowsPaidUseCase,
    private readonly splitRecurrenceUseCase: SplitRecurrenceUseCase,
    private readonly updateRecurrenceUseCase: UpdateRecurrenceUseCase,
  ) {}

  async create(userId: string, input: CreateRecurrenceApiInput, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const result = await this.createRecurrenceUseCase.execute({
      ...input,
      accessibleOwners,
      today: resolveToday(today),
    });

    return {
      occurrences: await this.toOccurrences(result.occurrences, today),
      overLimit: result.overLimit,
      recurrence: toRecurrenceOutput(result.recurrence),
    };
  }

  async delete(userId: string, id: string, confirmPaid?: boolean) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return this.deleteRecurrenceUseCase.execute({ accessibleOwners, confirmPaid, id });
  }

  async deleteOccurrence(
    userId: string,
    id: string,
    occurrenceNumber: number,
    scope: InstallmentEditScope,
    confirmPaid?: boolean,
    today?: string,
  ): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteOccurrenceUseCase.execute({
      accessibleOwners,
      confirmPaid,
      occurrenceNumber,
      recurrenceId: id,
      scope,
      today: resolveToday(today),
    });
  }

  async findAll(
    userId: string,
    ownerIds?: string[],
    filter: { accountId?: string; creditCardId?: string; status?: RecurrenceStatus } = {},
  ) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const series = await this.getRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds,
      ...filter,
    });

    return series.map((item) => toRecurrenceOutput(item));
  }

  async findOne(userId: string, id: string, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const details = await this.getRecurrenceUseCase.execute({
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return {
      occurrences: await this.toOccurrences(details.occurrences, today),
      projected: details.projected.map((item) => toProjectedOutput(item)),
      recurrence: toRecurrenceOutput(details.recurrence),
    };
  }

  async findProjections(
    userId: string,
    range: { from: string; to: string },
    ownerIds?: string[],
    today?: string,
  ) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const resolved = resolveToday(today);

    // Real rows first: whatever the horizon already reaches must not be projected a second time.
    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds,
      today: resolved,
    });

    const projected = await this.getProjectionsUseCase.execute({
      accessibleOwners,
      ...range,
      ownerIds,
      today: resolved,
    });

    return projected.map((item) => toProjectedOutput(item));
  }

  async materializeOccurrence(
    userId: string,
    id: string,
    occurrenceNumber: number,
    input: MaterializeOccurrenceApiInput,
    today?: string,
  ) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const { scope, ...fields } = input;
    void scope;
    const { overLimit, transaction } = await this.materializeOccurrenceUseCase.execute({
      ...fields,
      accessibleOwners,
      occurrenceNumber,
      recurrenceId: id,
      today: resolveToday(today),
    });
    const [resolved] = await this.toOccurrences([transaction], today);

    return { ...resolved, overLimit: transaction.creditCardId ? overLimit : undefined };
  }

  async split(userId: string, id: string, input: SplitRecurrenceApiInput, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const result = await this.splitRecurrenceUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return {
      ended: result.ended ? toRecurrenceOutput(result.ended) : null,
      occurrences: await this.toOccurrences(result.occurrences, today),
      recurrence: toRecurrenceOutput(result.recurrence),
    };
  }

  async update(userId: string, id: string, input: UpdateRecurrenceApiInput, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const updated = await this.updateRecurrenceUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return toRecurrenceOutput(updated);
  }

  // Card rows derive `paid` from their invoice (spec 033).
  private async toOccurrences(rows: TransactionEntity[], today?: string) {
    const resolved = await this.resolveCardRowsPaidUseCase.execute({
      today: resolveToday(today),
      transactions: rows,
    });

    return resolved.map((row) => toTransactionOutput(row));
  }
}
