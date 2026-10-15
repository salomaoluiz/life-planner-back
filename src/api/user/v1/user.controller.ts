import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AccountDeletionService } from '@api/user/v1/account-deletion.service';
import { DeleteAccountApiSchema, DeleteAccountInput } from '@api/user/v1/dto/delete-account.dto';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

import { FindUserByIdOutput } from './dto/find-user-by-id.dto';
import { UpdateUserInput, UpdateUserOutput } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiBearerAuth('JWT')
@Controller({
  path: 'user',
  version: '1',
})
export class UserController {
  constructor(
    private readonly accountDeletionService: AccountDeletionService,
    private readonly userService: UserService,
  ) {}

  @ApiNoContentResponse()
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@Request() req: JwtPayload & Request, @Body() body: DeleteAccountInput) {
    // The target is always the token user. The body only carries the email confirmation.
    const input = validate(DeleteAccountApiSchema, body);

    await this.accountDeletionService.deleteAccount(req.user.id, input);
  }

  @Get('/me')
  @ZodResponse({ status: 200, type: FindUserByIdOutput })
  async findMe(@Request() req: JwtPayload & Request) {
    const userId = req.user.id;
    return this.findById(userId);
  }

  // Find user by ID

  @Get(':id')
  @ZodResponse({ status: 200, type: FindUserByIdOutput })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: UpdateUserOutput })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserInput) {
    return this.userService.update(id, updateUserDto);
  }
}
