// Injection token for "does the token's user still exist?". Bound in the API layer (the user module lives outside shared).
export const USER_EXISTS_CHECK = 'USER_EXISTS_CHECK';

export interface IUserExistsCheck {
  execute(userId: string): Promise<boolean>;
}
