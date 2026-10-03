import { Module } from '@nestjs/common';

import { AuthController } from '@api/auth/v1/auth.controller';
import { AuthService } from '@api/auth/v1/auth.service';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [AuthController],
  imports: [UserModule],
  providers: [AuthService],
})
export class AuthAPIModule {}
