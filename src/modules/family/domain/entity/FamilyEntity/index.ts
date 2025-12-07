interface IFamilyEntity {
  id: string;
  name: string;
  ownerId: string;
}

class FamilyEntity {
  id: string;
  name: string;
  ownerId: string;

  constructor(params: IFamilyEntity) {
    this.name = params.name;
    this.id = params.id;
    this.ownerId = params.ownerId;
  }
}
export default FamilyEntity;
