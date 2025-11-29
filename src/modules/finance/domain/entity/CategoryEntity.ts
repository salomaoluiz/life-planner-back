interface ICategoryEntity {
  icon: string;
  id: string;
  name: string;
  ownerId: string;
  // Optional properties
  depthLevel?: number;
  parentId?: string;
}

class CategoryEntity {
  icon: string;
  id: string;
  name: string;
  ownerId: string;
  // Optional properties
  depthLevel?: number;
  parentId?: string;

  constructor(params: ICategoryEntity) {
    this.icon = params.icon;
    this.id = params.id;
    this.name = params.name;
    this.ownerId = params.ownerId;

    // Optional properties
    this.depthLevel = params.depthLevel;
    this.parentId = params.parentId;
  }
}

export default CategoryEntity;
