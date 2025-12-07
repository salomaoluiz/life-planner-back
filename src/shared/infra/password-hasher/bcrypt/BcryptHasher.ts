import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

import { IPasswordHasher } from '@shared/infra/password-hasher';

@Injectable()
export class BcryptHasher implements IPasswordHasher {
  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return compare(password, hashedPassword);
  }

  async hash(password: string): Promise<string> {
    const saltRounds = 10;
    return hash(password, saltRounds);
  }
}
