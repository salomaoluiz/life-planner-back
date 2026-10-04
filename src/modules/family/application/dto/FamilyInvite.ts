export type AcceptFamilyInviteInput = {
  token: string;
  userEmail: string;
  userId: string;
};
export type FamilyInvitePreviewInput = {
  token: string;
  userEmail: string;
};
export type FamilyInvitePreviewOutput = {
  email: string;
  emailMatches: boolean;
  familyId: string;
  familyName: string;
  inviteExpiresAt: Date;
};

export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
