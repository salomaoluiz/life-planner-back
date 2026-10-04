import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  FamilyInvitePreviewOutput,
  FamilyMemberOutput,
  InviteFamilyMemberApiSchema,
  InviteFamilyMemberInput,
  InviteFamilyMemberOutput,
  InviteTokenApiSchema,
} from '@api/family-member/v1/dto/family-member.dto';
import { FamilyMemberService } from '@api/family-member/v1/family-member.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// No path on the controller: the five routes live under three different prefixes
// (`families/:familyId/members`, `family-members/:memberId`, `family-invites/:token`).
@ApiBearerAuth('JWT')
@Controller({ version: '1' })
export class FamilyMemberController {
  constructor(private readonly familyMemberService: FamilyMemberService) {}

  @HttpCode(HttpStatus.OK)
  @Post('family-invites/:token/accept')
  @ZodResponse({ status: 200, type: FamilyMemberOutput })
  async accept(@Request() req: JwtPayload & Request, @Param('token') token: string) {
    const validToken = validate(InviteTokenApiSchema, token);

    return this.familyMemberService.accept(req.user.id, validToken);
  }

  @ApiNoContentResponse()
  @Delete('family-members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.familyMemberService.delete(req.user.id, memberId);
  }

  @Get('families/:familyId/members')
  @ZodResponse({ status: 200, type: [FamilyMemberOutput] })
  async findAll(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    return this.familyMemberService.findAll(req.user.id, familyId);
  }

  @Post('families/:familyId/members')
  @ZodResponse({ status: 201, type: InviteFamilyMemberOutput })
  async invite(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() body: InviteFamilyMemberInput,
  ) {
    const input = validate(InviteFamilyMemberApiSchema, body);

    return this.familyMemberService.invite(req.user.id, familyId, input);
  }

  @Get('family-invites/:token')
  @ZodResponse({ status: 200, type: FamilyInvitePreviewOutput })
  async preview(@Request() req: JwtPayload & Request, @Param('token') token: string) {
    const validToken = validate(InviteTokenApiSchema, token);

    return this.familyMemberService.preview(req.user.id, validToken);
  }
}
