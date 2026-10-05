interface IFamilyMemberEntity {
  createdAt: Date;
  email: string;
  familyId: string;
  id: string;
  // Optional properties
  inviteExpiresAt?: Date;
  joinedAt?: Date;
  userId?: string;
}

class FamilyMemberEntity {
  createdAt: Date;
  email: string;
  familyId: string;
  id: string;
  // Optional properties
  inviteExpiresAt?: Date;
  joinedAt?: Date;
  userId?: string;

  constructor({
    createdAt,
    email,
    familyId,
    id,
    inviteExpiresAt,
    joinedAt,
    userId,
  }: IFamilyMemberEntity) {
    this.createdAt = createdAt;
    this.email = email;
    this.familyId = familyId;
    this.id = id;
    // Optional properties
    this.inviteExpiresAt = inviteExpiresAt;
    this.joinedAt = joinedAt;
    this.userId = userId;
  }
}

export default FamilyMemberEntity;
