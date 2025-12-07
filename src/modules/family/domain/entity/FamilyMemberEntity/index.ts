interface IFamilyMemberEntity {
  email: string;
  familyId: string;
  id: string;
  // Optional properties
  joinedAt?: Date;
  userId?: string;
}

class FamilyMemberEntity {
  email: string;
  familyId: string;
  id: string;
  // Optional properties
  joinedAt?: Date;
  userId?: string;

  constructor({ email, familyId, id, joinedAt, userId }: IFamilyMemberEntity) {
    this.email = email;
    this.familyId = familyId;
    this.id = id;
    // Optional properties
    this.joinedAt = joinedAt;
    this.userId = userId;
  }
}

export default FamilyMemberEntity;
