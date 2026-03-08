import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength
} from "class-validator";

export class CreateMosqueMemberDto {
  @ApiProperty({ example: "MOSQ-0001" })
  @IsString()
  @MaxLength(40)
  memberCode!: string;

  @ApiProperty({ example: "Amadou Traore" })
  @IsString()
  @MaxLength(140)
  fullName!: string;

  @ApiPropertyOptional({ example: "M", enum: ["M", "F"] })
  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @ApiPropertyOptional({ example: "+2250707070707" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "traore@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ example: "Abobo, Abidjan" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "2024-01-20" })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @ApiPropertyOptional({ example: "ACTIVE", enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}

export class UpdateMosqueMemberDto extends PartialType(CreateMosqueMemberDto) {}

export class CreateMosqueActivityDto {
  @ApiProperty({ example: "JUMUAH-2026-01" })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: "Khoutbah du vendredi" })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: "2026-03-06" })
  @IsDateString()
  activityDate!: string;

  @ApiProperty({ example: "JUMUAH" })
  @IsString()
  @MaxLength(40)
  category!: string;

  @ApiPropertyOptional({ example: "Mosquee Blanche" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: "Ouvert a tous les parents et eleves." })
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSchoolLinked?: boolean;
}

export class UpdateMosqueActivityDto extends PartialType(CreateMosqueActivityDto) {}

export class CreateMosqueDonationDto {
  @ApiPropertyOptional({ example: "8b73ad73-226f-43fe-b6d3-c8f7a54cf719" })
  @IsOptional()
  @IsUUID("all")
  memberId?: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: "CFA", default: "CFA" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: "CASH", enum: ["CASH", "MOBILE_MONEY", "BANK", "TRANSFER", "OTHER"] })
  @IsOptional()
  @IsIn(["CASH", "MOBILE_MONEY", "BANK", "TRANSFER", "OTHER"])
  channel?: "CASH" | "MOBILE_MONEY" | "BANK" | "TRANSFER" | "OTHER";

  @ApiPropertyOptional({ example: "2026-03-06T10:30:00.000Z" })
  @IsOptional()
  @IsDateString()
  donatedAt?: string;

  @ApiPropertyOptional({ example: "DON-2026-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceNo?: string;

  @ApiPropertyOptional({ example: "Don pour travaux de maintenance." })
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  notes?: string;
}

export class UpdateMosqueDonationDto extends PartialType(CreateMosqueDonationDto) {}
