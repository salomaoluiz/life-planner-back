import { Injectable } from '@nestjs/common';

import { TransactionLookups } from '@api/finance/v1/dto/transaction.dto';
import { GetTransferLookupsUseCase } from '@finance/application/use-case/GetTransferLookupsUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { CurrencyCode } from '@finance/domain/enum/Currency';

// Spec 098 FR 9: adds `lookups.transfers` (and the readable counterpart accounts) for the rows that belong to a transfer.
// One extra read, and only when the page has a transfer row, so the list keeps its budget otherwise.
@Injectable()
export class TransferLookupsService {
  constructor(private readonly getTransferLookupsUseCase: GetTransferLookupsUseCase) {}

  async attach(
    accessibleOwners: OwnerAccess[],
    rows: TransactionEntity[],
    lookups: TransactionLookups,
  ): Promise<TransactionLookups> {
    const transferIds = rows.map((row) => row.transferId).filter((id): id is string => id !== null);

    if (transferIds.length === 0) {
      return lookups;
    }

    const { accounts, transfers } = await this.getTransferLookupsUseCase.execute({
      accessibleOwners,
      transferIds,
    });

    return {
      ...lookups,
      accounts: {
        ...Object.fromEntries(
          accounts.map((account) => [account.id, { icon: account.icon, name: account.name }]),
        ),
        ...lookups.accounts,
      },
      transfers: Object.fromEntries(
        transfers.map((transfer) => [
          transfer.id,
          {
            amountIn: transfer.amountIn,
            amountOut: transfer.amountOut,
            counterpartHidden: transfer.counterpartHidden ? (true as const) : undefined,
            currencyIn: transfer.currencyIn as CurrencyCode,
            currencyOut: transfer.currencyOut as CurrencyCode,
            dateIn: transfer.dateIn,
            dateOut: transfer.dateOut,
            feeTransactionId: transfer.feeRowId ?? undefined,
            fromAccountId: transfer.fromAccountId ?? undefined,
            recurrenceId: transfer.recurrenceId ?? undefined,
            toAccountId: transfer.toAccountId ?? undefined,
          },
        ]),
      ),
    };
  }
}
