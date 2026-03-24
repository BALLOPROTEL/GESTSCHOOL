import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../security/public.decorator";
import { RateLimit } from "../security/rate-limit.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { FirstConnectionDto } from "./dto/first-connection.dto";
import {
  AuthService,
  type AuthTokensResponse,
  type ForgotPasswordResponse,
  type MessageResponse
} from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @RateLimit({ bucket: "auth-login", max: 5, windowMs: 60_000 })
  @ApiOperation({ summary: "JWT login endpoint" })
  async login(@Body() body: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(body);
  }

  @Public()
  @Post("refresh")
  @RateLimit({ bucket: "auth-refresh", max: 20, windowMs: 60_000 })
  @ApiOperation({ summary: "Refresh access token using refresh token rotation" })
  async refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ bucket: "auth-logout", max: 20, windowMs: 60_000 })
  @ApiOperation({ summary: "Revoke refresh token (logout)" })
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @RateLimit({ bucket: "auth-forgot-password", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Generate a password reset token" })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post("reset-password")
  @RateLimit({ bucket: "auth-reset-password", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Reset user password with reset token" })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(body);
  }

  @Public()
  @Post("first-connection")
  @RateLimit({ bucket: "auth-first-connection", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Complete first connection with temporary password" })
  async completeFirstConnection(@Body() body: FirstConnectionDto): Promise<MessageResponse> {
    return this.authService.completeFirstConnection(body);
  }
}
