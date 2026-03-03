import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from "class-validator";

export class CreateSchoolYearDto {
  @ApiProperty({ example: "2026-2027" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2027-06-30" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSchoolYearDto extends PartialType(CreateSchoolYearDto) {}

export class CreateCycleDto {
  @ApiProperty({ example: "PRIMARY" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Primary" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateCycleDto extends PartialType(CreateCycleDto) {}

export class CreateLevelDto {
  @ApiProperty()
  @IsUUID("all")
  cycleId!: string;

  @ApiProperty({ example: "CP1" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Cours Preparatoire 1" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateLevelDto extends PartialType(CreateLevelDto) {}

export class CreateClassroomDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty()
  @IsUUID("all")
  levelId!: string;

  @ApiProperty({ example: "CP1-A" })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: "CP1 A" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateClassroomDto extends PartialType(CreateClassroomDto) {}

export class CreateSubjectDto {
  @ApiProperty({ example: "MATH" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Mathematiques" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isArabic?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class CreateAcademicPeriodDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty({ example: "T1" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Trimestre 1" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-12-20" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: "TRIMESTER" })
  @IsString()
  @MaxLength(20)
  periodType!: string;
}

export class UpdateAcademicPeriodDto extends PartialType(CreateAcademicPeriodDto) {}
