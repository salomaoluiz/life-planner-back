import { Injectable } from '@nestjs/common';

import {
  CreateSplitApiInput,
  SplitItem,
  SplitUpdateResult,
  SplitWithLookups,
  UpdateSplitApiInput,
} from '@api/finance/v1/dto/split.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { SplitLookupsService } from '@api/finance/v1/split-lookups.service';
import { toTransactionItem, toTransactionLookups } from '@api/finance/v1/transaction.service';
import { CreateSplitUseCase } from '@finance/application/use-case/CreateSplitUseCase';
import { DeleteSplitUseCase } from '@finance/application/use-case/DeleteSplitUseCase';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import { UpdateSplitUseCase } from '@finance/application/use-case/UpdateSplitUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

function toSplitItem(split: SplitEntity): SplitItem {
  return {
    accountId: split.accountId ?? undefined,
    creditCardId: split.creditCardId ?? undefined,
    currency: split.currency,
    date: split.date,
    description: split.description,
    id: split.id,
    invoiceMonth: split.invoiceMonth ?? undefined,
    notes: split.notes ?? undefined,
    occurrenceNumber: split.occurrenceNumber ?? undefined,
    owner: split.owner,
    ownerId: split.ownerId,
    paid: split.paid ?? undefined,
    parts: split.parts.map((part) => toTransactionItem(part)),
    recurrenceId: split.recurrenceId ?? undefined,
    total: split.total,
    type: split.type,
  };
}

export { toSplitItem };

@Injectable()
export class SplitService {
  constructor(
    private readonly createSplitUseCase: CreateSplitUseCase,
    private readonly deleteSplitUseCase: DeleteSplitUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getSplitUseCase: GetSplitUseCase,
    private readonly splitLookupsService: SplitLookupsService,
    private readonly updateSplitUseCase: UpdateSplitUseCase,
  ) {}

  async create(
    userId: string,
    input: CreateSplitApiInput,
    today?: string,
  ): Promise<SplitWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const split = await this.createSplitUseCase.execute({
      ...input,
      accessibleOwners,
      requesterId: userId,
      today: resolveToday(today),
    });

    return this.toResponse(accessibleOwners, split);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteSplitUseCase.execute({ accessibleOwners, id });
  }

  async findById(userId: string, id: string): Promise<SplitWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return this.toResponse(
      accessibleOwners,
      await this.getSplitUseCase.execute({ accessibleOwners, id }),
    );
  }

  private async toResponse(
    accessibleOwners: OwnerAccess[],
    split: SplitEntity,
  ): Promise<SplitWithLookups> {
    return {
      item: toSplitItem(split),
      lookups: await this.splitLookupsService.attach(
        accessibleOwners,
        split.parts,
        toTransactionLookups(split.parts),
      ),
    };
  }

  async update(
    userId: string,
    id: string,
    input: UpdateSplitApiInput,
    today?: string,
  ): Promise<SplitUpdateResult> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const result = await this.updateSplitUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    if (result.dissolved) {
      const row: TransactionEntity = result.dissolved;

      return {
        dissolved: true,
        item: toTransactionItem(row),
        lookups: toTransactionLookups([row]),
      };
    }

    return this.toResponse(accessibleOwners, result.split as SplitEntity);
  }
}
