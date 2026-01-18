import { Module } from '@nestjs/common';

import { UserModule } from '@user/user.module';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  imports: [UserModule],
  providers: [UserService],
})
export class UserAPIModule {}
