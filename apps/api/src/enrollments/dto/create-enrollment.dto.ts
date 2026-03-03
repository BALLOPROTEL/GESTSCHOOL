import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateEnrollmentDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty({ example: "2026-09-15" })
  @IsDateString()
  enrollmentDate!: string;

  @ApiPropertyOptional({ example: "ENROLLED" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  enrollmentStatus?: string;
}
