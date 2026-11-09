import { Inject } from '@nestjs/common';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { z } from 'zod';

const GetTransferLookupsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  transferIds: z.array(z.string().min(1)),
});

export type GetTransferLookupsInput = z.input<typeof GetTransferLookupsSchema>;

// Spec 098 FR 9: what a list needs to draw a transfer row. The side the caller cannot read is blanked (account, its
// amount and, for the destination, the fee): `counterpartHidden` tells it apart from a removed account (null id only).
export interface TransferLookup {
  amountIn: null | number;
  amountOut: null | number;
  counterpartHidden: boolean;
  currencyIn: string;
  currencyOut: string;
  dateIn: string;
  dateOut: string;
  feeRowId: null | string;
  fromAccountId: null | string;
  id: string;
  recurrenceId: null | string;
  toAccountId: null | string;
}

export interface TransferLookups {
  // The readable accounts of the transfers, for `lookups.accounts`.
  accounts: AccountEntity[];
  transfers: TransferLookup[];
}

function canRead(accessibleOwners: OwnerAccess[], account: AccountEntity | undefined): boolean {
  return account !== undefined && hasOwnerAccess(accessibleOwners, account);
}

export class GetTransferLookupsUseCase implements UseCaseWithParams<
  GetTransferLookupsInput,
  TransferLookups
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: GetTransferLookupsInput): Promise<TransferLookups> {
    const input = validate(GetTransferLookupsSchema, params);
    const ids = [...new Set(input.transferIds)];

    if (ids.length === 0) {
      return { accounts: [], transfers: [] };
    }

    const transfers = await this.transferRepository.findTransfersByIds(ids);
    const accountIds = [
      ...new Set(
        transfers.flatMap((transfer) => [transfer.fromAccountId, transfer.toAccountId]).filter(
          (id): id is string => id !== null,
        ),
      ),
    ];
    const accounts = await this.accountRepository.findAccountsByIds(accountIds);
    const readable = accounts.filter((account) => canRead(input.accessibleOwners, account));

    return {
      accounts: readable,
      transfers: transfers.map((transfer) => {
        const from = accounts.find((account) => account.id === transfer.fromAccountId);
        const to = accounts.find((account) => account.id === transfer.toAccountId);
        const fromHidden = transfer.fromAccountId !== null && !canRead(input.accessibleOwners, from);
        const toHidden = transfer.toAccountId !== null && !canRead(input.accessibleOwners, to);

        return {
          amountIn: toHidden ? null : transfer.amountIn,
          amountOut: fromHidden ? null : transfer.amountOut,
          counterpartHidden: fromHidden || toHidden,
          currencyIn: transfer.currencyIn,
          currencyOut: transfer.currencyOut,
          dateIn: transfer.dateIn,
          dateOut: transfer.dateOut,
          feeRowId: toHidden ? null : transfer.feeRowId,
          fromAccountId: fromHidden ? null : transfer.fromAccountId,
          id: transfer.id,
          recurrenceId: transfer.recurrenceId,
          toAccountId: toHidden ? null : transfer.toAccountId,
        };
      }),
    };
  }
}
