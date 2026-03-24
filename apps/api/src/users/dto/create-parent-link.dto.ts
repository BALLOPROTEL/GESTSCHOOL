import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateParentLinkDto {
  @ApiProperty({
    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    description: "User id with PARENT role"
  })
  @IsUUID()
  parentUserId!: string;

  @ApiProperty({ example: "3fa85f64-5717-4562-b3fc-2c963f66afb7" })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ example: "Pere" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  relationship?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
