import { Global, Module } from '@nestjs/common';

import { USER_EXISTS_CHECK } from '@shared/infra/http/guards/types';
import { UserExistsUseCase } from '@user/application/use-case/UserExistsUseCase';
import { UserModule } from '@user/user.module';

// Global so the APP_GUARD in SharedModule (which must not import the user module) can inject the check.
@Global()
@Module({
  exports: [USER_EXISTS_CHECK],
  imports: [UserModule],
  providers: [{ provide: USER_EXISTS_CHECK, useExisting: UserExistsUseCase }],
})
export class UserExistsCheckModule {}
