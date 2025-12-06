export interface IJwtProvider {
  sign(payload: JwtUserPayload): Promise<string>;
  verify<T = JwtUserPayload>(token: string): Promise<T>;
}
export interface JwtUserPayload {
  id: string;
}
