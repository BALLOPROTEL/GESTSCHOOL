import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from "class-validator";

export class CreateFeePlanDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty()
  @IsUUID("all")
  levelId!: string;

  @ApiProperty({ example: "Frais annuels CP1" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @IsPositive()
  totalAmount!: number;

  @ApiPropertyOptional({ example: "CFA", default: "CFA" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class UpdateFeePlanDto extends PartialType(CreateFeePlanDto) {}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  feePlanId?: string;

  @ApiPropertyOptional({ example: "INV-2026-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  invoiceNo?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountDue?: number;

  @ApiPropertyOptional({ example: "2026-11-30" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountDue?: number;

  @ApiPropertyOptional({ example: "2026-11-30" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: "OPEN", enum: ["OPEN", "PARTIAL", "PAID", "VOID"] })
  @IsOptional()
  @IsIn(["OPEN", "PARTIAL", "PAID", "VOID"])
  status?: "OPEN" | "PARTIAL" | "PAID" | "VOID";
}

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID("all")
  invoiceId!: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  paidAmount!: number;

  @ApiProperty({ example: "CASH", enum: ["CASH", "MOBILE_MONEY", "BANK"] })
  @IsIn(["CASH", "MOBILE_MONEY", "BANK"])
  paymentMethod!: "CASH" | "MOBILE_MONEY" | "BANK";

  @ApiPropertyOptional({ example: "2026-09-12T10:30:00.000Z" })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: "TRX-778899" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceExternal?: string;
}
