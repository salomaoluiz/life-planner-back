import { User } from '@db/client';

export interface IUserDatasource {
  findByEmail(email: string): Promise<null | User>;
  findById(id: string): Promise<null | User>;
  save(user: User): Promise<User>;
}
