import UserEntity from '@user/domain/entity/UserEntity';

export type IUserRepository = {
  createUser(params: UserEntity): Promise<{ id: string }>;
  getUserByEmail(email: string): Promise<undefined | UserEntity>;
  getUserById(id: string): Promise<undefined | UserEntity>;
};
