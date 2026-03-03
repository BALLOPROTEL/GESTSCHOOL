import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

import { UserRole } from "../../security/roles.enum";

export class CreateUserDto {
  @ApiProperty({ example: "enseignant@gestschool.local" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: "teacher1234" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ENSEIGNANT })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
