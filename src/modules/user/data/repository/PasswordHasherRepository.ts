import { Inject, Injectable } from '@nestjs/common';

import { IPasswordHasher } from '@shared/infra/password-hasher';
import { IPasswordHasherRepository } from '@user/domain/repository/IPasswordHasherRepository';

@Injectable()
export class PasswordHasherRepository implements IPasswordHasherRepository {
  constructor(@Inject('IPasswordHasher') private readonly passwordHasher: IPasswordHasher) {}

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return this.passwordHasher.compare(password, hashedPassword);
  }

  async hash(password: string): Promise<string> {
    return this.passwordHasher.hash(password);
  }
}
