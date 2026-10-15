import { Family } from '@db/client';

export interface CreateFamilyDatasourceParams {
  email: string;
  name: string;
  owner_id: string;
}
export interface DeleteUserDataDatasourceParams {
  email: string;
  userId: string;
}
export interface IFamilyDatasource {
  create(params: CreateFamilyDatasourceParams): Promise<Family>;
  delete(id: string): Promise<void>;
  // One transaction: families owned by the user (members cascade), the user's other memberships and pending invites to the email.
  deleteUserData(params: DeleteUserDataDatasourceParams): Promise<UserDataDeletion>;
  findById(id: string): Promise<Family | null>;
  findByUserId(userId: string): Promise<Family[]>;
  findIdsByOwnerId(ownerId: string): Promise<string[]>;
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
export interface UserDataDeletion {
  families: number;
  memberships: number;
}
