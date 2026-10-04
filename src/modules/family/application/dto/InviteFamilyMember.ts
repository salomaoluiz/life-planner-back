import { z } from 'zod';

import { FamilyMemberUseCaseOutput } from '@family/application/dto/FamilyMemberOutput';
import { emailSchema } from '@shared/infra/validation/email';

export const InviteFamilyMemberSchema = z.object({
  email: emailSchema,
  familyId: z.string().min(1),
  userId: z.string().min(1),
});

export type InviteFamilyMemberInput = z.infer<typeof InviteFamilyMemberSchema>;
export type InviteFamilyMemberOutput = {
  inviteExpiresAt: Date;
  inviteToken: string;
  member: FamilyMemberUseCaseOutput;
};
