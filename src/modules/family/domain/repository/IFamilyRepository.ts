import FamilyEntity from '@family/domain/entity/FamilyEntity';

export type IFamilyRepository = {
  createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity>;
  deleteFamily(id: string): Promise<void>;
  getFamilies(userId: string): Promise<FamilyEntity[]>;
  getFamilyById(familyId: string): Promise<FamilyEntity | undefined>;
  isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean>;
  updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity>;
};

interface CreateFamilyRepositoryParams {
  name: string;
  ownerEmail: string;
  ownerId: string;
}
interface IsFamilyMemberRepositoryParams {
  familyId: string;
  userId: string;
}
interface UpdateFamilyRepositoryParams {
  id: string;
  name: string;
}

export {
  CreateFamilyRepositoryParams,
  IsFamilyMemberRepositoryParams,
  UpdateFamilyRepositoryParams,
};
