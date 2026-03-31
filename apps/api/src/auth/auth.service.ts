import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User } from "@prisma/client";
import { compare, hash } from "bcryptjs";

import { AuditService } from "../audit/audit.service";
import { findPasswordPolicyViolation } from "../common/password-policy";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import { FirstConnectionDto } from "./dto/first-connection.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

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

export type ForgotPasswordResponse = {
  message: string;
  debugResetToken?: string;
  debugExpiresAt?: string;
};

export type MessageResponse = {
  message: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async login(payload: LoginDto): Promise<AuthTokensResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();

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

  async forgotPassword(payload: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: payload.username,
        isActive: true,
        deletedAt: null
      }
    });

    const genericMessage =
      "Si le compte existe, la demande de reinitialisation a ete enregistree.";
    if (!user) {
      return { message: genericMessage };
    }

    const expiresIn = this.configService.get<string>("PASSWORD_RESET_EXPIRES_IN", "20m");
    const expiresInSeconds = this.resolveExpirationSeconds(expiresIn);
    const resetToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        tenantId: user.tenantId,
        username: user.username,
        purpose: "PASSWORD_RESET"
      },
      {
        secret: this.getPasswordResetSecret(),
        expiresIn: expiresInSeconds,
        issuer: this.getJwtIssuer(),
        audience: this.getPasswordResetAudience()
      }
    );

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_FORGOT_PASSWORD_REQUESTED", {
      username: user.username
    });

    if (this.shouldExposePasswordResetToken()) {
      return {
        message: genericMessage,
        debugResetToken: resetToken,
        debugExpiresAt: expiresAt.toISOString()
      };
    }

    return { message: genericMessage };
  }

  async resetPassword(payload: ResetPasswordDto): Promise<MessageResponse> {
    type ResetTokenPayload = {
      sub: string;
      tenantId: string;
      username: string;
      purpose: string;
    };

    let tokenPayload: ResetTokenPayload;
    try {
      tokenPayload = await this.jwtService.verifyAsync<ResetTokenPayload>(payload.token, {
        secret: this.getPasswordResetSecret(),
        issuer: this.getJwtIssuer(),
        audience: this.getPasswordResetAudience()
      });
    } catch {
      throw new UnauthorizedException("Token de reinitialisation invalide ou expire.");
    }

    if (tokenPayload.purpose !== "PASSWORD_RESET") {
      throw new UnauthorizedException("Token de reinitialisation invalide.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: tokenPayload.sub,
        tenantId: tokenPayload.tenantId,
        username: tokenPayload.username,
        isActive: true,
        deletedAt: null
      }
    });

    if (!user) {
      throw new UnauthorizedException("Compte introuvable pour ce token de reinitialisation.");
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);

    const samePassword = await compare(payload.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException("Le nouveau mot de passe doit etre different de l'ancien.");
    }

    await this.replaceUserPassword(user, payload.newPassword);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_PASSWORD_RESET_SUCCESS", {
      username: user.username
    });
    return { message: "Mot de passe reinitialise avec succes." };
  }

  async completeFirstConnection(payload: FirstConnectionDto): Promise<MessageResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: payload.username,
        isActive: true,
        deletedAt: null
      }
    });

    if (!user) {
      throw new UnauthorizedException("Compte introuvable.");
    }

    const hasTemporaryPassword = await compare(payload.temporaryPassword, user.passwordHash);
    if (!hasTemporaryPassword) {
      throw new UnauthorizedException("Mot de passe temporaire invalide.");
    }

    if (payload.newPassword === payload.temporaryPassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit etre different du mot de passe temporaire."
      );
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);

    await this.replaceUserPassword(user, payload.newPassword);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_FIRST_CONNECTION_COMPLETED", {
      username: user.username
    });
    return { message: "Premiere connexion finalisee. Vous pouvez maintenant vous connecter." };
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
      {
        expiresIn: expiresInSeconds,
        issuer: this.getJwtIssuer(),
        audience: this.getJwtAudience()
      }
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

  private getDefaultTenantId(): string {
    return this.configService.get<string>(
      "DEFAULT_TENANT_ID",
      "00000000-0000-0000-0000-000000000001"
    );
  }

  private getPasswordResetSecret(): string {
    return this.configService.get<string>(
      "PASSWORD_RESET_SECRET",
      this.configService.get<string>("JWT_SECRET", "dev-only-secret-change-me")
    );
  }

  private getJwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "gestschool");
  }

  private getJwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "gestschool-clients");
  }

  private getPasswordResetAudience(): string {
    return this.configService.get<string>(
      "PASSWORD_RESET_AUDIENCE",
      `${this.getJwtAudience()}-password-reset`
    );
  }

  private shouldExposePasswordResetToken(): boolean {
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development").trim().toLowerCase();
    if (nodeEnv === "production") {
      return false;
    }

    const raw = this.configService
      .get<string>("PASSWORD_RESET_DEV_EXPOSE_TOKEN", "false")
      .trim()
      .toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }

  private assertPasswordPolicy(password: string, username?: string): void {
    const violation = findPasswordPolicyViolation(password, username);
    if (violation) {
      throw new BadRequestException(violation);
    }
  }

  private async replaceUserPassword(
    user: Pick<User, "id" | "tenantId">,
    nextPassword: string
  ): Promise<void> {
    const now = new Date();
    const passwordHash = await hash(nextPassword, 10);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          updatedAt: now
        }
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });
    });
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
      await this.auditService.enqueueLog({
        tenantId,
        userId,
        action,
        resource: "auth",
        payload
      });
    } catch {
      // Never block auth flow because of audit logging issues.
    }
  }
}
