import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { UserModule } from '@api/v1/user/user.module';

@Module({
  imports: [
    UserModule,
    RouterModule.register([
      {
        module: UserModule,
        path: 'v1',
      },
    ]),
  ],
})
export class V1Module {}
