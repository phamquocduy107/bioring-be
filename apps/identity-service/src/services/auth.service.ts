import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/prisma';

@Injectable()
export class AuthService {
  private readonly MAX_ACTIVE_TOKENS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleGoogleLogin(dto: {
    email: string;
    firstName: string;
    lastName?: string;
    picture?: string;
    provider: string;
    deviceAgent?: string;
    ipAddress?: string;
  }) {
    let user = await this.prisma.users.findUnique({
      where: { email: dto.email },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user) {
      const defaultRole = await this.prisma.roles.findFirst({
        where: {
          name: this.configService.get<string>('DEFAULT_USER_ROLE', 'CUSTOMER'),
        },
      });

      user = await this.prisma.users.create({
        data: {
          email: dto.email,
          full_name: `${dto.firstName} ${dto.lastName ?? ''}`.trim(),
          status: 'ACTIVE',
          user_roles: defaultRole
            ? { create: { role_id: defaultRole.id } }
            : undefined,
        },
        include: { user_roles: { include: { roles: true } } },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email ?? '');

    const existingTokens = await this.prisma.refresh_tokens.count({
      where: { user_id: user.id, is_revoked: false },
    });

    if (existingTokens >= this.MAX_ACTIVE_TOKENS) {
      const oldestTokens = await this.prisma.refresh_tokens.findMany({
        where: { user_id: user.id, is_revoked: false },
        orderBy: { created_at: 'asc' },
        take: existingTokens - this.MAX_ACTIVE_TOKENS + 1,
      });
      await this.prisma.refresh_tokens.updateMany({
        where: { id: { in: oldestTokens.map((t) => t.id) } },
        data: { is_revoked: true },
      });
    }

    await this.prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        token: tokens.refreshToken,
        expires_at: new Date(
          Date.now() +
            Number(
              this.configService.get<number>(
                'JWT_REFRESH_TOKEN_EXPIRATION',
                604800000,
              ),
            ),
        ),
        device_agent: dto.deviceAgent,
        ip_address: dto.ipAddress,
      },
    });

    return {
      user: this.mapUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(dto: {
    oldRefreshToken: string;
    deviceAgent?: string;
    ipAddress?: string;
  }) {
    let payload: { sub: string; email: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.oldRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const storedToken = await this.prisma.refresh_tokens.findUnique({
      where: { token: dto.oldRefreshToken },
    });

    if (!storedToken || storedToken.is_revoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expires_at < new Date()) {
      await this.prisma.refresh_tokens.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email ?? '');

    await this.prisma.$transaction(async (tx) => {
      await tx.refresh_tokens.delete({ where: { id: storedToken.id } });
      await tx.refresh_tokens.create({
        data: {
          user_id: user.id,
          token: tokens.refreshToken,
          expires_at: new Date(
            Date.now() +
              Number(
                this.configService.get<number>(
                  'JWT_REFRESH_TOKEN_EXPIRATION',
                  604800000,
                ),
              ),
          ),
          device_agent: dto.deviceAgent,
          ip_address: dto.ipAddress,
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refresh_tokens.deleteMany({
      where: { token: refreshToken },
    });
    return { success: true };
  }

  private async generateTokens(userId: string, email: string) {
    const userRoles = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: { roles: true },
    });

    const roleNames = userRoles.map((ur) => ur.roles.name);

    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
      role: roleNames,
      type: 'access',
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get<number>(
          'JWT_REFRESH_TOKEN_EXPIRATION',
          604800000,
        ),
      },
    );

    return { accessToken, refreshToken };
  }

  private mapUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      status: user.status,
      customerType: user.customer_type,
      isVip: user.is_vip,
      createdAt: user.created_at?.toISOString(),
      updatedAt: user.updated_at?.toISOString(),
      roles: user.user_roles?.map((ur: any) => ur.roles.name) ?? [],
    };
  }
}
