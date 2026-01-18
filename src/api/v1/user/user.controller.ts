import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { JwtPayload } from '@shared/infra/jwt/types';

import { FindUserByIdOutput } from './dto/find-user-by-id.dto';
import { UpdateUserInput, UpdateUserOutput } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiBearerAuth('JWT')
@Controller({
  path: 'user',
})
export class UserController {
  constructor(private readonly userService: UserService) {}

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
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserInput) {
    return this.userService.update(id, updateUserDto);
  }
}
