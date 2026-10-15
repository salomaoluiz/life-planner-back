import { Inject } from '@nestjs/common';

import {
  HasFinanceDataByOwnerInput,
  HasFinanceDataByOwnerSchema,
} from '@finance/application/dto/HasFinanceDataByOwner';
import {
  IFinanceAccountRepository,
  IFinanceCategoryRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// "Does this owner still have finance records?": used by the family delete guard (409).
// One cheap existence query per table.
export class HasFinanceDataByOwnerUseCase implements UseCaseWithParams<
  HasFinanceDataByOwnerInput,
  boolean
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: HasFinanceDataByOwnerInput): Promise<boolean> {
    const input = validate(HasFinanceDataByOwnerSchema, params);

    const results = await Promise.all([
      this.accountRepository.existsByOwner(input),
      this.categoryRepository.existsByOwner(input),
      this.creditCardRepository.existsByOwner(input),
      this.transactionRepository.existsByOwner(input),
    ]);

    return results.some(Boolean);
  }
}
