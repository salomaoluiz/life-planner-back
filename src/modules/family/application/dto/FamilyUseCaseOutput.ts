import FamilyEntity from '@family/domain/entity/FamilyEntity';

export type FamilyUseCaseOutput = {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;
};

export function toFamilyUseCaseOutput(family: FamilyEntity): FamilyUseCaseOutput {
  return {
    createdAt: family.createdAt,
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    updatedAt: family.updatedAt,
  };
}
