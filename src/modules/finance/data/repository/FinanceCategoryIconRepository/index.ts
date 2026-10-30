import { Inject, Injectable } from '@nestjs/common';

import {
  CategoryIconRow,
  IFinanceCategoryIconDatasource,
} from '@finance/data/repository/datasource/IFinanceCategoryIconDatasource';
import { CategoryIconEntity } from '@finance/domain/entity/CategoryIconEntity';
import { IFinanceCategoryIconRepository } from '@finance/domain/repository';

function toEntity(row: CategoryIconRow): CategoryIconEntity {
  return {
    common: row.common,
    group: row.group_key,
    labelEn: row.label_en,
    labelPt: row.label_pt,
    name: row.name,
    sort: row.sort,
  };
}

@Injectable()
export class FinanceCategoryIconRepository implements IFinanceCategoryIconRepository {
  constructor(
    @Inject('IFinanceCategoryIconDatasource')
    private readonly iconDatasource: IFinanceCategoryIconDatasource,
  ) {}

  async listAll(): Promise<CategoryIconEntity[]> {
    return (await this.iconDatasource.listAll()).map(toEntity);
  }

  async search(params: { limit: number; terms: string[] }): Promise<CategoryIconEntity[]> {
    return (await this.iconDatasource.search(params)).map(toEntity);
  }

  async searchSimilar(params: { limit: number; text: string }): Promise<CategoryIconEntity[]> {
    return (await this.iconDatasource.searchSimilar(params)).map(toEntity);
  }
}
