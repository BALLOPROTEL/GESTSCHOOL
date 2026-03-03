import { createHash, randomBytes } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User } from "@prisma/client";
import { compare } from "bcryptjs";

import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import { LoginDto } from "./dto/login.dto";

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
    tenantId: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async login(payload: LoginDto): Promise<AuthTokensResponse> {
    const defaultTenantId = this.configService.get<string>(
      "DEFAULT_TENANT_ID",
      "00000000-0000-0000-0000-000000000001"
    );
    const tenantId = payload.tenantId || defaultTenantId;

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: payload.username,
        isActive: true,
        deletedAt: null
      }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid username or password.");
    }

    const isPasswordValid = await compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid username or password.");
    }

    const tokens = await this.issueTokens(user);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_LOGIN_SUCCESS", {
      username: user.username,
      role: user.role
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const refreshRecord = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!refreshRecord || !refreshRecord.user.isActive || refreshRecord.user.deletedAt) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    await this.prisma.refreshToken.update({
      where: { id: refreshRecord.id },
      data: { revokedAt: new Date() }
    });

    const tokens = await this.issueTokens(refreshRecord.user);
    await this.logAuthAudit(
      refreshRecord.user.tenantId,
      refreshRecord.user.id,
      "AUTH_REFRESH_SUCCESS"
    );
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      select: {
        tenantId: true,
        userId: true
      }
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    if (rows[0]) {
      await this.logAuthAudit(rows[0].tenantId, rows[0].userId, "AUTH_LOGOUT_SUCCESS");
    }
  }

  private async issueTokens(user: User): Promise<AuthTokensResponse> {
    const expiresIn = this.configService.get<string>("JWT_EXPIRES_IN", "1h");
    const expiresInSeconds = this.resolveExpirationSeconds(expiresIn);
    const refreshDaysRaw = this.configService.get<string>(
      "REFRESH_TOKEN_TTL_DAYS",
      "30"
    );
    const refreshDaysCandidate = Number(refreshDaysRaw);
    const refreshDays =
      Number.isFinite(refreshDaysCandidate) && refreshDaysCandidate > 0
        ? refreshDaysCandidate
        : 30;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      },
      { expiresIn: expiresInSeconds }
    );

    const rawRefreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: "Bearer",
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        role: user.role as UserRole,
        tenantId: user.tenantId
      }
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private resolveExpirationSeconds(expiresIn: string): number {
    const pattern = /^(\d+)([smhd])?$/i;
    const match = expiresIn.trim().match(pattern);

    if (!match) {
      return 3600;
    }

    const value = Number(match[1]);
    const unit = (match[2] || "s").toLowerCase();

    if (unit === "s") {
      return value;
    }
    if (unit === "m") {
      return value * 60;
    }
    if (unit === "h") {
      return value * 3600;
    }
    return value * 86400;
  }

  private async logAuthAudit(
    tenantId: string,
    userId: string,
    action: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    try {
      await this.prisma.iamAuditLog.create({
        data: {
          tenantId,
          userId,
          action,
          resource: "auth",
          payload
        }
      });
    } catch {
      // Never block auth flow because of audit logging issues.
    }
  }
}
