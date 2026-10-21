import { Injectable } from '@nestjs/common';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday, toOwnerIds } from '@api/finance/v1/finance-query';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { CountExportTransactionsUseCase } from '@finance/application/use-case/CountExportTransactionsUseCase';
import { ExportTransactionsUseCase } from '@finance/application/use-case/ExportTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';

export interface ExportRequest {
  accountId?: string | string[];
  creditCardId?: string | string[];
  from: string;
  owner: 'ALL' | 'FAMILY' | 'USER';
  ownerId?: string;
  to: string;
  today?: string;
}

@Injectable()
export class TransactionCsvService {
  constructor(
    private readonly countExportTransactionsUseCase: CountExportTransactionsUseCase,
    private readonly exportTransactionsUseCase: ExportTransactionsUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getUserFamiliesUseCase: GetUserFamiliesUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
  ) {}

  async count(userId: string, request: ExportRequest): Promise<{ count: number }> {
    const accessibleOwners = await this.prepare(userId, request);

    return this.countExportTransactionsUseCase.execute({
      accessibleOwners,
      accountIds: toOwnerIds(request.accountId),
      creditCardIds: toOwnerIds(request.creditCardId),
      from: request.from,
      owner: request.owner,
      ownerId: request.ownerId,
      to: request.to,
    });
  }

  async export(
    userId: string,
    request: { format: 'BR' | 'INTL'; lang: 'en-US' | 'pt-BR' } & ExportRequest,
  ): Promise<{ csv: string; filename: string }> {
    const accessibleOwners = await this.prepare(userId, request);
    const families = await this.getUserFamiliesUseCase.execute({ userId });

    return this.exportTransactionsUseCase.execute({
      accessibleOwners,
      accountIds: toOwnerIds(request.accountId),
      creditCardIds: toOwnerIds(request.creditCardId),
      format: request.format,
      from: request.from,
      lang: request.lang,
      owner: request.owner,
      ownerId: request.ownerId,
      ownerNames: Object.fromEntries(families.map((family) => [family.id, family.name])),
      to: request.to,
      today: resolveToday(request.today),
    });
  }

  // Due recurring occurrences become real rows before they are counted or written (spec 034 FR 9).
  private async prepare(userId: string, request: ExportRequest) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      today: resolveToday(request.today),
    });

    return accessibleOwners;
  }
}
