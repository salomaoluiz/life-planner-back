import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  AdjustAccountBalanceInput,
  AdjustAccountBalanceSchema,
} from '@finance/application/dto/AdjustAccountBalance';
import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  BALANCE_ADJUSTMENT_DESCRIPTION,
  SYSTEM_CATEGORY_IDS,
} from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// "Make my balance X": records the difference as a normal transaction on the system category
// BALANCE_ADJUSTMENT, dated today (client date), on the account's owner. No difference, no row.
export class AdjustAccountBalanceUseCase implements UseCaseWithParams<
  AdjustAccountBalanceInput,
  AccountWithBalances
> {
  constructor(
    @Inject(AttachAccountBalancesUseCase)
    private readonly attachAccountBalancesUseCase: AttachAccountBalancesUseCase,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: AdjustAccountBalanceInput): Promise<AccountWithBalances> {
    const input = validate(AdjustAccountBalanceSchema, params);

    const account = await this.accountRepository.findAccountById(input.id);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException();
    }

    if (account.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Account is archived');
    }

    const [current] = await this.attachAccountBalancesUseCase.execute({
      accounts: [account],
      today: input.today,
    });
    const difference = input.balance - current.balance;

    if (difference === 0) {
      return current;
    }

    // Two int4 balances can be further apart than one int4 transaction value can express.
    if (Math.abs(difference) > INT4_MAX) {
      throw new BadRequestException('Balance adjustment is too large');
    }

    await this.transactionRepository.createTransaction({
      accountId: account.id,
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT],
      date: input.today,
      description: BALANCE_ADJUSTMENT_DESCRIPTION,
      owner: account.owner,
      ownerId: account.ownerId,
      paid: true,
      type: difference > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
      value: Math.abs(difference),
    });

    // The ledger changed with the write: read the account again.
    const refreshed = await this.accountRepository.findAccountById(account.id);

    if (!refreshed) {
      throw new NotFoundException();
    }

    const [updated] = await this.attachAccountBalancesUseCase.execute({
      accounts: [refreshed],
      today: input.today,
    });

    return updated;
  }
}
