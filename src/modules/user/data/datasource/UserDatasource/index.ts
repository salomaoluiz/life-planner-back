import { Injectable } from '@nestjs/common';

import { User } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { IUserDatasource } from '@user/data/repository/datasource/IUserDatasource';

@Injectable()
export class UserDatasource implements IUserDatasource {
  constructor(private readonly db: Database) {}

  async create(user: User): Promise<User> {
    const { email, id, name, password_hash, photo_url } = user;
    return this.db.client.user.create({
      data: {
        email,
        id,
        name,
        password_hash,
        photo_url,
      },
    });
  }

  async findByEmail(email: string): Promise<null | User> {
    return this.db.client.user.findFirst({
      where: {
        email,
      },
    });
  }

  async findById(id: string): Promise<null | User> {
    return this.db.client.user.findUnique({
      where: {
        id,
      },
    });
  }

  async update(user: User): Promise<User> {
    const { email, id, name, password_hash, photo_url } = user;

    return this.db.client.user.update({
      data: {
        email,
        name,
        password_hash,
        photo_url,
      },
      where: {
        id: id,
      },
    });
  }
}
