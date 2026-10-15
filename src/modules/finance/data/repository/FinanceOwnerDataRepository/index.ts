import { Inject, Injectable } from '@nestjs/common';

import { IFinanceOwnerDataDatasource } from '@finance/data/repository/datasource/IFinanceOwnerDataDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceOwnerDataRepository } from '@finance/domain/repository';

@Injectable()
export class FinanceOwnerDataRepository implements IFinanceOwnerDataRepository {
  constructor(
    @Inject('IFinanceOwnerDataDatasource')
    private readonly ownerDataDatasource: IFinanceOwnerDataDatasource,
  ) {}

  async deleteAllByOwner(access: OwnerAccess): Promise<number> {
    return this.ownerDataDatasource.deleteAllByOwner({
      owner: access.owner,
      owner_id: access.ownerId,
    });
  }
}
