import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from "../../common/password-policy";

export class FirstConnectionDto {
  @ApiProperty({ example: "enseignant@gestschool.local" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({
    required: false,
    example: "00000000-0000-0000-0000-000000000001"
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  tenantId?: string;

  @ApiProperty({ example: "temporaryPass123" })
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @ApiProperty({ example: "Definitif3Mot!" })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
