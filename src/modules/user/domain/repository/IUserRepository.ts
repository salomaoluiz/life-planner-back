import UserEntity from '@user/domain/entity/UserEntity';

export type IUserRepository = {
  createUser(params: UserEntity): Promise<{ id: string }>;
  getUser(): Promise<UserEntity>;
  getUserById(id: string): Promise<undefined | UserEntity>;
};
