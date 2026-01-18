import { uuidV4 } from '@shared/infra/uuid';

interface IUserProfileEntity {
  email: string;
  id?: string;
  name: string;
  passwordHash: string;
  // Optional fields
  photoUrl?: string;
}

class UserEntity {
  email: string;
  id: string;
  name: string;
  passwordHash: string;
  // Optional fields
  photoUrl?: string;

  constructor(props: IUserProfileEntity) {
    this.id = props.id ?? uuidV4();
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    // Optional fields
    this.photoUrl = props.photoUrl;
  }
}

export default UserEntity;
