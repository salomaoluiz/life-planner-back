import { User } from '@db/client';

export interface IUserDatasource {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<null | User>;
  findById(id: string): Promise<null | User>;
  update(user: User): Promise<User>;
}
