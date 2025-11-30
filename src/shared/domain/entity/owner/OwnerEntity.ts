export enum OwnerType {
  FAMILY = 'FAMILY',
  USER = 'USER',
}

interface IOwnerEntity {
  id: string;
  ownerId: string;
  type: OwnerType;
}

class OwnerEntity {
  id: string;
  ownerId: string;
  type: OwnerType;

  constructor(params: IOwnerEntity) {
    this.id = params.id;
    this.ownerId = params.ownerId;
    this.type = params.type;
  }
}

export default OwnerEntity;
