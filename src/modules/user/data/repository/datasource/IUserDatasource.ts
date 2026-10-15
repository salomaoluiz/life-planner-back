import { User } from '@db/client';

export interface IUserDatasource {
  create(user: User): Promise<User>;
  existsById(id: string): Promise<boolean>;
  findByEmail(email: string): Promise<null | User>;
  findById(id: string): Promise<null | User>;
  findByIds(ids: string[]): Promise<User[]>;
  update(user: User): Promise<User>;
}
