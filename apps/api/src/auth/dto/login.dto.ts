import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@gestschool.local" })
  @IsString()
  username!: string;

  @ApiProperty({ example: "change-me-strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: "00000000-0000-0000-0000-000000000001",
    description: "Optional tenant UUID. Defaults to DEFAULT_TENANT_ID."
  })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  tenantId?: string;
}
