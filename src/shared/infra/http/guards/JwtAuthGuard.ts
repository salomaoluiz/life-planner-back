import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@shared/infra/http/decorators/Public';
import { IUserExistsCheck, USER_EXISTS_CHECK } from '@shared/infra/http/guards/types';
import { IJwtProvider } from '@shared/infra/jwt/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('IJwtProvider') private readonly jwtProvider: IJwtProvider,
    private readonly reflector: Reflector,
    @Inject(USER_EXISTS_CHECK) private readonly userExistsCheck: IUserExistsCheck,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    let userId: string | undefined;

    try {
      const tokenParsed = await this.jwtProvider.verify(token);

      request['user'] = tokenParsed.user;
      userId = tokenParsed.user?.id;
    } catch {
      throw new UnauthorizedException();
    }

    // Outside the try: a failing lookup is a server error, never a 401 (the app logs out on 401).
    if (!userId || !(await this.userExistsCheck.execute(userId))) {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractTokenFromHeader(request: {
    headers: { authorization?: string };
  }): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
