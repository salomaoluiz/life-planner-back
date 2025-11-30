import { Module } from '@nestjs/common';

import { UserModule } from './controller/user/user.module';

@Module({
  imports: [UserModule],
})
export class ApiModule {}
