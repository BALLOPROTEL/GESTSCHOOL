import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AcademicPlacementStatus, AcademicTrack } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

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

  @ApiPropertyOptional({ enum: AcademicTrack, default: AcademicTrack.FRANCOPHONE })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiProperty({ example: "2026-09-15" })
  @IsDateString()
  enrollmentDate!: string;

  @ApiPropertyOptional({ example: "ENROLLED" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  enrollmentStatus?: string;
}

export class CreateStudentTrackPlacementDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty({ enum: AcademicTrack })
  @IsEnum(AcademicTrack)
  track!: AcademicTrack;

  @ApiProperty()
  @IsUUID("all")
  levelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  classId?: string;

  @ApiPropertyOptional({ enum: AcademicPlacementStatus })
  @IsOptional()
  @IsEnum(AcademicPlacementStatus)
  placementStatus?: AcademicPlacementStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: "2026-09-15" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: "2027-06-30" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
