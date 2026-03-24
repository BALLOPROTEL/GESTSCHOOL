import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateTeacherNotificationDto {
  @ApiProperty({ description: "Assigned class id used as scope for broadcast" })
  @IsUUID("all")
  classId!: string;

  @ApiPropertyOptional({ description: "Optional specific student in selected class" })
  @IsOptional()
  @IsUUID("all")
  studentId?: string;

  @ApiProperty({ example: "Rappel devoir maison" })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: "Merci de signer le carnet pour demain." })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ enum: ["IN_APP", "EMAIL", "SMS"], default: "IN_APP" })
  @IsOptional()
  @IsIn(["IN_APP", "EMAIL", "SMS"])
  channel?: "IN_APP" | "EMAIL" | "SMS";

  @ApiPropertyOptional({
    description: "Optional explicit target address (email/phone) for EMAIL/SMS."
  })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  targetAddress?: string;

  @ApiPropertyOptional({ example: "2026-09-12T08:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
