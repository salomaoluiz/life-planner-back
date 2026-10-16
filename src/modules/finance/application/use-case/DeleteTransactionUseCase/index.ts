import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  DeleteTransactionInput,
  DeleteTransactionSchema,
} from '@finance/application/dto/DeleteTransaction';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SystemCategoryKey } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteTransactionUseCase implements UseCaseWithParams<DeleteTransactionInput, void> {
  constructor(
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteTransactionInput): Promise<void> {
    const input = validate(DeleteTransactionSchema, params);

    const transaction = await this.transactionRepository.findTransactionById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    // The payment transaction goes away only with the payment itself.
    if (transaction.category.systemKey === SystemCategoryKey.INVOICE_PAYMENT) {
      throw new UnprocessableEntityException('Use the invoice to change this payment');
    }

    await this.transactionRepository.deleteTransaction(input.id);
  }
}
