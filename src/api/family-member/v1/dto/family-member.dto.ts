import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TOKEN_REGEX } from '@shared/infra/token';
import { emailSchema } from '@shared/infra/validation/email';

export const InviteFamilyMemberApiSchema = z.object({ email: emailSchema });
export const InviteTokenApiSchema = z.string().regex(TOKEN_REGEX);

export const FamilyMemberApiSchema = z.object({
  email: z.string(),
  familyId: z.uuid(),
  id: z.uuid(),
  inviteExpired: z.boolean(),
  joinedAt: z.iso.datetime().nullable(),
  role: z.enum(['MEMBER', 'OWNER']),
  status: z.enum(['JOINED', 'PENDING']),
  user: z.object({ name: z.string(), photoUrl: z.string().nullable() }).nullable(),
  userId: z.uuid().nullable(),
});

export const InviteFamilyMemberApiOutputSchema = z.object({
  inviteExpiresAt: z.iso.datetime(),
  inviteToken: z.string(),
  member: FamilyMemberApiSchema,
});

export const FamilyInvitePreviewApiSchema = z.object({
  email: z.string(),
  emailMatches: z.boolean(),
  familyId: z.uuid(),
  familyName: z.string(),
  inviteExpiresAt: z.iso.datetime(),
});

export class FamilyInvitePreviewOutput extends createZodDto(FamilyInvitePreviewApiSchema) {}
export class FamilyMemberOutput extends createZodDto(FamilyMemberApiSchema) {}
export class InviteFamilyMemberInput extends createZodDto(InviteFamilyMemberApiSchema) {}
export class InviteFamilyMemberOutput extends createZodDto(InviteFamilyMemberApiOutputSchema) {}
