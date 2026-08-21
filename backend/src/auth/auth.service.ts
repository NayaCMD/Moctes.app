import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipStatus, Prisma, WorkspaceRole } from '@prisma/client';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { SESSION_TTL_MS } from './session-cookie';
import type {
  AuthPrincipal,
  IssuedSession,
  SessionMetadata,
} from './auth.types';

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.from('moctes-auth-dummy-salt').toString('base64url')}$${scryptSync('invalid-password', 'moctes-auth-dummy-salt', 64).toString('base64url')}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            name: dto.name.trim(),
            email,
            passwordHash,
          },
        });
        const workspace = await transaction.workspace.create({
          data: {
            name: `Espaço de ${createdUser.name}`,
            slug: personalWorkspaceSlug(createdUser.name),
            createdById: createdUser.id,
          },
        });
        await transaction.membership.create({
          data: {
            userId: createdUser.id,
            workspaceId: workspace.id,
            role: WorkspaceRole.OWNER,
          },
        });
        return createdUser;
      });
      return this.issueSession(user.id, metadata);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('An account already uses this email.');
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
      select: { id: true, passwordHash: true },
    });
    const valid = await this.passwords.verify(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueSession(user.id, metadata);
  }

  async authenticate(token: string): Promise<AuthPrincipal | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: MembershipStatus.ACTIVE },
              include: { workspace: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!session) {
      return null;
    }
    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    if (
      Date.now() - session.lastSeenAt.getTime() >=
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return toPrincipal(session);
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  private async issueSession(
    userId: string,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: metadata.userAgent?.slice(0, 500),
        ipAddress: metadata.ipAddress?.slice(0, 64),
      },
    });
    const principal = await this.authenticate(token);
    if (!principal) {
      throw new Error('The newly created session could not be loaded.');
    }
    return { token, principal };
  }
}

function toPrincipal(session: {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    memberships: Array<{
      role: WorkspaceRole;
      workspace: { id: string; name: string; slug: string };
    }>;
  };
}): AuthPrincipal {
  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    workspaces: session.user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function personalWorkspaceSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return `${base || 'workspace'}-${randomBytes(5).toString('hex')}`;
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
