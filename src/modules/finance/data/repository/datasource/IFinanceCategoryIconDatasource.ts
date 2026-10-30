export interface CategoryIconRow {
  common: boolean;
  group_key: string;
  label_en: string;
  label_pt: string;
  name: string;
  sort: number;
}
export interface IFinanceCategoryIconDatasource {
  listAll(): Promise<CategoryIconRow[]>;
  // Prefix full-text search; `terms` are already normalized (see `toSearchTerms`).
  search(params: { limit: number; terms: string[] }): Promise<CategoryIconRow[]>;
  // Trigram fallback for typos (similarity >= 0.3) over the same text.
  searchSimilar(params: { limit: number; text: string }): Promise<CategoryIconRow[]>;
}
