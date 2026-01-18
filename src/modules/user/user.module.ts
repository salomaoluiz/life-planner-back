import { Module } from '@nestjs/common';

import { LoginByEmailUseCase } from '@user/application/use-cases/LoginByEmailUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-cases/SignUpByEmailUseCase';
import { UserDatasource } from '@user/data/datasource/UserDatasource';
import { PasswordHasherRepository } from '@user/data/repository/PasswordHasherRepository';
import { UserRepository } from '@user/data/repository/UserRepository';

@Module({
  exports: [LoginByEmailUseCase, SignUpByEmailUseCase],
  providers: [
    LoginByEmailUseCase,
    SignUpByEmailUseCase,
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
    {
      provide: 'IUserDatasource',
      useClass: UserDatasource,
    },
    {
      provide: 'IPasswordHasherRepository',
      useClass: PasswordHasherRepository,
    },
  ],
})
export class UserModule {}
