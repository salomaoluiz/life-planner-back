import { OwnerType } from '@db/client';
import { FinancialTagWithScopes } from '@finance/data/datasource/mapper/FinanceTagMapper';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateTagDatasourceParams {
  all_scopes?: boolean;
  creator_id: string;
  name: string;
  owner: OwnerType;
  owner_id: string;
  scopes?: TagScopeDatasourceParams[];
}
export interface ExistsTagDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface FindTagConflictsDatasourceParams {
  exclude_id?: string;
  name: string;
  scopes: OwnerAccess[];
}
export interface FindTagsByOwnersDatasourceParams {
  owners: OwnerAccess[];
  q?: string;
}
export interface IFinanceTagDatasource {
  // Gives every ALL tag of `creator_id` one more scope row (idempotent).
  addScope(params: { creator_id: string } & TagScopeDatasourceParams): Promise<void>;
  // Transactions plus recurrences per tag, counted in `owners` only.
  countUsage(tagIds: string[], owners: OwnerAccess[]): Promise<Map<string, number>>;
  create(params: CreateTagDatasourceParams): Promise<FinancialTagWithScopes>;
  delete(id: string): Promise<void>;
  // Spec 043 §4: the family gets its own copy of the creator's ALL tags, repoints its links, drops the scope.
  detachFamilyScope(params: { creator_id: string; family_id: string }): Promise<number>;
  exists(params: ExistsTagDatasourceParams): Promise<boolean>;
  // Tags (other than `exclude_id`) usable in one of `scopes` whose name equals `name` ignoring case.
  findById(id: string): Promise<FinancialTagWithScopes | null>;
  findByOwners(params: FindTagsByOwnersDatasourceParams): Promise<FinancialTagWithScopes[]>;
  findConflicts(params: FindTagConflictsDatasourceParams): Promise<FinancialTagWithScopes[]>;
  removeScope(params: TagScopeDatasourceParams): Promise<void>;
  update(params: UpdateTagDatasourceParams): Promise<FinancialTagWithScopes>;
}
export interface TagScopeDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface UpdateTagDatasourceParams {
  id: string;
  name?: string;
  // Switch to ALL: the tag gets the flag, the creator, their Personal scope as owner and `scopes`.
  scope?: { creator_id: string; scopes: TagScopeDatasourceParams[] };
}
