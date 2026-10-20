import FamilyEntity from '@family/domain/entity/FamilyEntity';
import { FamilyStatus } from '@family/domain/enum';

export type FamilyUseCaseOutput = {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  status: FamilyStatus;
  updatedAt: Date;
};

export function toFamilyUseCaseOutput(family: FamilyEntity): FamilyUseCaseOutput {
  return {
    createdAt: family.createdAt,
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    status: family.status,
    updatedAt: family.updatedAt,
  };
}
