import { Inject, Injectable } from '@nestjs/common';

import { IFinanceOwnerVersionDatasource } from '@finance/data/repository/datasource/IFinanceOwnerVersionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceOwnerVersionRepository } from '@finance/domain/repository';

@Injectable()
export class FinanceOwnerVersionRepository implements IFinanceOwnerVersionRepository {
  constructor(
    @Inject('IFinanceOwnerVersionDatasource')
    private readonly ownerVersionDatasource: IFinanceOwnerVersionDatasource,
  ) {}

  async findVersions(owners: OwnerAccess[]): Promise<number[]> {
    const rows = await this.ownerVersionDatasource.findMany(
      owners.map((access) => ({ owner: access.owner, owner_id: access.ownerId })),
    );
    const byKey = new Map(rows.map((row) => [`${row.owner}:${row.owner_id}`, Number(row.version)]));

    return owners.map((access) => byKey.get(`${access.owner}:${access.ownerId}`) ?? 0);
  }
}
