import { Module } from '@nestjs/common';

import { ConfirmUserEmailUseCase } from '@user/application/use-case/ConfirmUserEmailUseCase';
import { DeleteUserUseCase } from '@user/application/use-case/DeleteUserUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { FindUsersByIdsUseCase } from '@user/application/use-case/FindUsersByIdsUseCase';
import { LoginByEmailUseCase } from '@user/application/use-case/LoginByEmailUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-case/SignUpByEmailUseCase';
import { UpdateUserUseCase } from '@user/application/use-case/UpdateUserUseCase';
import { UserExistsUseCase } from '@user/application/use-case/UserExistsUseCase';
import { UserDatasource } from '@user/data/datasource/UserDatasource';
import { PasswordHasherRepository } from '@user/data/repository/PasswordHasherRepository';
import { UserRepository } from '@user/data/repository/UserRepository';

const useCases = [
  ConfirmUserEmailUseCase,
  DeleteUserUseCase,
  LoginByEmailUseCase,
  SignUpByEmailUseCase,
  FindUserByIdUseCase,
  FindUsersByIdsUseCase,
  UpdateUserUseCase,
  UserExistsUseCase,
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
