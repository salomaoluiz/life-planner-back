import { CategoryIconEntity } from '@finance/domain/entity/CategoryIconEntity';

export type IFinanceCategoryIconRepository = {
  listAll(): Promise<CategoryIconEntity[]>;
  search(params: { limit: number; terms: string[] }): Promise<CategoryIconEntity[]>;
  searchSimilar(params: { limit: number; text: string }): Promise<CategoryIconEntity[]>;
};
