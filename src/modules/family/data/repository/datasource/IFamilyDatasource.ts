import { Family } from '@db/client';

export interface CreateFamilyDatasourceParams {
  email: string;
  name: string;
  owner_id: string;
}
export interface IFamilyDatasource {
  create(params: CreateFamilyDatasourceParams): Promise<Family>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Family | null>;
  findByUserId(userId: string): Promise<Family[]>;
  isMember(params: IsMemberDatasourceParams): Promise<boolean>;
  update(params: UpdateFamilyDatasourceParams): Promise<Family>;
}
export interface IsMemberDatasourceParams {
  familyId: string;
  userId: string;
}
export interface UpdateFamilyDatasourceParams {
  id: string;
  name: string;
}
