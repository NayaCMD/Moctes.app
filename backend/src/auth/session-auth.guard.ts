import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { readSessionToken } from './session-cookie';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);
    const principal = token ? await this.authService.authenticate(token) : null;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required.');
    }
    request.auth = principal;
    return true;
  }
}
