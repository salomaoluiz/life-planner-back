interface IFamilyEntity {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;
}

class FamilyEntity {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;

  constructor(params: IFamilyEntity) {
    this.createdAt = params.createdAt;
    this.id = params.id;
    this.name = params.name;
    this.ownerId = params.ownerId;
    this.updatedAt = params.updatedAt;
  }
}
export default FamilyEntity;
