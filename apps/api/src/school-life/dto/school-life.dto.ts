import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class CreateAttendanceDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty({ example: "2026-09-12" })
  @IsDateString()
  attendanceDate!: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
    default: "PRESENT"
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  status?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateAttendanceDto extends PartialType(CreateAttendanceDto) {}

export class CreateAttendanceAttachmentDto {
  @ApiProperty({ example: "certificat-medical.pdf" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: "https://files.gestschool.local/justificatifs/certificat-medical.pdf" })
  @IsString()
  @MaxLength(2000)
  fileUrl!: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;
}

export class UpdateAttendanceValidationDto {
  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status!: "PENDING" | "APPROVED" | "REJECTED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  comment?: string;
}

export class BulkAttendanceEntryDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"]
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  status?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BulkAttendanceDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty({ example: "2026-09-12" })
  @IsDateString()
  attendanceDate!: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
    default: "PRESENT"
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  defaultStatus?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiProperty({ type: [BulkAttendanceEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries!: BulkAttendanceEntryDto[];
}

export class CreateTimetableSlotDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty({ example: 1, description: "1=Monday ... 7=Sunday" })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: "08:00" })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @ApiProperty({ example: "09:00" })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  @ApiPropertyOptional({ example: "Salle B" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  room?: string;

  @ApiPropertyOptional({ example: "Mme Traore" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  teacherName?: string;
}

export class UpdateTimetableSlotDto extends PartialType(CreateTimetableSlotDto) {}

export class CreateNotificationDto {
  @ApiPropertyOptional({ description: "Optional targeted student" })
  @IsOptional()
  @IsUUID("all")
  studentId?: string;

  @ApiPropertyOptional({
    enum: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT"]
  })
  @IsOptional()
  @IsIn(["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT"])
  audienceRole?: "ADMIN" | "SCOLARITE" | "ENSEIGNANT" | "COMPTABLE" | "PARENT";

  @ApiProperty({ example: "Retard de paiement" })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: "Merci de regulariser avant le 15/10." })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ example: "IN_APP", enum: ["IN_APP", "EMAIL", "SMS"], default: "IN_APP" })
  @IsOptional()
  @IsIn(["IN_APP", "EMAIL", "SMS"])
  channel?: "IN_APP" | "EMAIL" | "SMS";

  @ApiPropertyOptional({
    description: "Optional explicit target address (email/phone). Required for EMAIL/SMS if not inferable."
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

export class UpdateNotificationStatusDto {
  @ApiProperty({ example: "SENT", enum: ["PENDING", "SCHEDULED", "SENT", "FAILED"] })
  @IsIn(["PENDING", "SCHEDULED", "SENT", "FAILED"])
  status!: "PENDING" | "SCHEDULED" | "SENT" | "FAILED";

  @ApiPropertyOptional({ example: "2026-09-12T08:01:00.000Z" })
  @IsOptional()
  @IsDateString()
  sentAt?: string;
}

export class DispatchPendingNotificationsDto {
  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class NotificationDeliveryEventDto {
  @ApiProperty({ example: "webhook-email-9f0b2ab11e6a" })
  @IsString()
  @MaxLength(160)
  providerMessageId!: string;

  @ApiPropertyOptional({ example: "WEBHOOK_EMAIL" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @ApiProperty({
    example: "DELIVERED",
    enum: ["SENT_TO_PROVIDER", "DELIVERED", "FAILED", "UNDELIVERABLE", "RETRYING"]
  })
  @IsIn(["SENT_TO_PROVIDER", "DELIVERED", "FAILED", "UNDELIVERABLE", "RETRYING"])
  status!: "SENT_TO_PROVIDER" | "DELIVERED" | "FAILED" | "UNDELIVERABLE" | "RETRYING";

  @ApiPropertyOptional({ example: "Mailbox rejected by provider" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @ApiPropertyOptional({ example: "2026-09-12T08:01:00.000Z" })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
