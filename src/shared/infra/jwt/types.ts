export interface IJwtProvider {
  sign(payload: JwtPayload): Promise<string>;
  verify<T = JwtPayload>(token: string): Promise<T>;
}
export interface JwtPayload {
  user: {
    id: string;
  };
}
