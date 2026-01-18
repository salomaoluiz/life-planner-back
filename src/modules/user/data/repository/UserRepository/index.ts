import { Inject, Injectable } from '@nestjs/common';

import { UserMapper } from '@user/data/datasource/mapper/UserMapper';
import { IUserDatasource } from '@user/data/repository/datasource/IUserDatasource';
import UserEntity from '@user/domain/entity/UserEntity';
import { IUserRepository } from '@user/domain/repository';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@Inject('IUserDatasource') private readonly userDatasource: IUserDatasource) {}

  async createUser(params: UserEntity): Promise<{ id: string }> {
    const user = UserMapper.toPersistence(params);
    const result = await this.userDatasource.create(user);

    return { id: result.id };
  }

  async getUserByEmail(email: string): Promise<undefined | UserEntity> {
    const result = await this.userDatasource.findByEmail(email);

    return result ? UserMapper.toDomain(result) : undefined;
  }

  async getUserById(id: string): Promise<undefined | UserEntity> {
    const result = await this.userDatasource.findById(id);

    return result ? UserMapper.toDomain(result) : undefined;
  }

  async updateUser(params: UserEntity): Promise<UserEntity> {
    const user = UserMapper.toPersistence(params);

    const result = await this.userDatasource.update(user);

    return UserMapper.toDomain(result);
  }
}
