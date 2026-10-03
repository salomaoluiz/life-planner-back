import { Module } from '@nestjs/common';

import { UserController } from '@api/user/v1/user.controller';
import { UserService } from '@api/user/v1/user.service';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [UserController],
  imports: [UserModule],
  providers: [UserService],
})
export class UserAPIModule {}
