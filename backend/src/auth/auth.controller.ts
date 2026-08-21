import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthPrincipal, SessionMetadata } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from './public.decorator';
import {
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from './session-cookie';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthPrincipal> {
    const session = await this.authService.register(dto, metadataFrom(request));
    this.setSessionCookie(response, session.token);
    return session.principal;
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthPrincipal> {
    const session = await this.authService.login(dto, metadataFrom(request));
    this.setSessionCookie(response, session.token);
    return session.principal;
  }

  @Get('session')
  async session(
    @Req() request: Request,
  ): Promise<
    { authenticated: false } | ({ authenticated: true } & AuthPrincipal)
  > {
    const token = readSessionToken(request);
    const principal = token ? await this.authService.authenticate(token) : null;
    return principal
      ? { authenticated: true, ...principal }
      : { authenticated: false };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.revoke(readSessionToken(request));
    response.clearCookie(
      SESSION_COOKIE_NAME,
      sessionCookieOptions(this.isProduction()),
    );
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(this.isProduction()),
    );
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}

function metadataFrom(request: Request): SessionMetadata {
  return {
    userAgent: request.get('user-agent'),
    ipAddress: request.ip,
  };
}
