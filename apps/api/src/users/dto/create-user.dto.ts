import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from "../../common/password-policy";
import { UserRole } from "../../security/roles.enum";

export class CreateUserDto {
  @ApiProperty({ example: "enseignant@gestschool.local" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: "Professeur2Mot!" })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ENSEIGNANT })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
