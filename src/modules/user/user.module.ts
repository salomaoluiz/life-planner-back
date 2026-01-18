import { Module } from '@nestjs/common';

import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { LoginByEmailUseCase } from '@user/application/use-case/LoginByEmailUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-case/SignUpByEmailUseCase';
import { UpdateUserUseCase } from '@user/application/use-case/UpdateUserUseCase';
import { UserDatasource } from '@user/data/datasource/UserDatasource';
import { PasswordHasherRepository } from '@user/data/repository/PasswordHasherRepository';
import { UserRepository } from '@user/data/repository/UserRepository';

const useCases = [
  LoginByEmailUseCase,
  SignUpByEmailUseCase,
  FindUserByIdUseCase,
  UpdateUserUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
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
