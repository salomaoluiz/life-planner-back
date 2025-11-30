import { Module } from '@nestjs/common';

import { UserModule } from '@api/v1/user/user.module';

@Module({
  imports: [UserModule],
})
export class V1Module {}
