import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from "class-validator";

export class AnalyticsOverviewQueryDto {
  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  schoolYearId?: string;
}

export class AuditLogQueryDto {
  @ApiPropertyOptional({ example: "users" })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ example: "USER_CREATED" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  userId?: string;

  @ApiPropertyOptional({ example: "admin" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class AuditLogExportQueryDto {
  @ApiPropertyOptional({ example: "PDF", enum: ["PDF", "EXCEL"], default: "PDF" })
  @IsOptional()
  @IsIn(["PDF", "EXCEL"])
  format?: "PDF" | "EXCEL";

  @ApiPropertyOptional({ example: "users" })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ example: "USER_CREATED" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  userId?: string;

  @ApiPropertyOptional({ example: "admin" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 500, default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
