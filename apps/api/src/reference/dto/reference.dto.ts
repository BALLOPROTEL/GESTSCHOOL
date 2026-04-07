import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AcademicStage, AcademicTrack, PedagogicalRuleType, RotationGroup } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
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

  @ApiPropertyOptional({ enum: AcademicStage, default: AcademicStage.PRIMARY })
  @IsOptional()
  @IsEnum(AcademicStage)
  academicStage?: AcademicStage;

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

  @ApiPropertyOptional({ enum: AcademicTrack, default: AcademicTrack.FRANCOPHONE })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiProperty({ example: "Cours Preparatoire 1" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

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

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiProperty({ example: "CP1-A" })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: "CP1 A" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

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

export class CreatePedagogicalRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  schoolYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  levelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  classId?: string;

  @ApiProperty({ example: "SECOND_CYCLE_TRACK_DAYS" })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: "Second cycle weekly track split" })
  @IsString()
  @MaxLength(140)
  label!: string;

  @ApiProperty({ enum: PedagogicalRuleType })
  @IsEnum(PedagogicalRuleType)
  ruleType!: PedagogicalRuleType;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

  @ApiProperty({ type: Object })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
