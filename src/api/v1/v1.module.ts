import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { AuthAPIModule } from '@api/v1/auth/auth.module';
import { UserAPIModule } from '@api/v1/user/user.module';

@Module({
  imports: [
    UserAPIModule,
    AuthAPIModule,
    RouterModule.register([
      {
        module: UserAPIModule,
        path: 'v1',
      },
      {
        module: AuthAPIModule,
        path: 'v1',
      },
    ]),
  ],
})
export class V1Module {}
