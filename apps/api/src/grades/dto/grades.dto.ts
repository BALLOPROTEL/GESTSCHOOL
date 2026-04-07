import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AcademicTrack } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class CreateGradeDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiProperty({ example: "Devoir 1" })
  @IsString()
  @MaxLength(120)
  assessmentLabel!: string;

  @ApiPropertyOptional({ example: "DEVOIR", enum: ["DEVOIR", "COMPOSITION", "ORAL", "TP"] })
  @IsOptional()
  @IsIn(["DEVOIR", "COMPOSITION", "ORAL", "TP"])
  assessmentType?: "DEVOIR" | "COMPOSITION" | "ORAL" | "TP";

  @ApiProperty({ example: 15.5 })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  scoreMax?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkGradeItemDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty({ example: 14 })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkCreateGradesDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiProperty({ example: "Devoir 2" })
  @IsString()
  @MaxLength(120)
  assessmentLabel!: string;

  @ApiPropertyOptional({ example: "DEVOIR", enum: ["DEVOIR", "COMPOSITION", "ORAL", "TP"] })
  @IsOptional()
  @IsIn(["DEVOIR", "COMPOSITION", "ORAL", "TP"])
  assessmentType?: "DEVOIR" | "COMPOSITION" | "ORAL" | "TP";

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  scoreMax?: number;

  @ApiProperty({ type: [BulkGradeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItemDto)
  grades!: BulkGradeItemDto[];
}

export class GenerateReportCardDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
