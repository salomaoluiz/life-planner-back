import { Inject } from '@nestjs/common';

import {
  GetAccountFavoriteInput,
  GetAccountFavoriteSchema,
} from '@finance/application/dto/GetAccountFavorite';
import { IFinanceAccountFavoriteRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The id of the favorite account of the user (spec 094): one read, never inferred.
export class GetAccountFavoriteUseCase implements UseCaseWithParams<
  GetAccountFavoriteInput,
  string | undefined
> {
  constructor(
    @Inject('IFinanceAccountFavoriteRepository')
    private readonly favoriteRepository: IFinanceAccountFavoriteRepository,
  ) {}

  async execute(params: GetAccountFavoriteInput): Promise<string | undefined> {
    const input = validate(GetAccountFavoriteSchema, params);

    return this.favoriteRepository.findByUser(input.userId);
  }
}
