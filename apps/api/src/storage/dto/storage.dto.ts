import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateUploadDescriptorDto {
  @ApiProperty({ example: "justificatif-absence.pdf" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({ example: "attendance/justificatifs" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  folder?: string;
}
