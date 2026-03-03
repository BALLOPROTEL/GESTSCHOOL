import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../security/public.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthService, type AuthTokensResponse } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "JWT login endpoint" })
  async login(@Body() body: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(body);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token using refresh token rotation" })
  async refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke refresh token (logout)" })
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
