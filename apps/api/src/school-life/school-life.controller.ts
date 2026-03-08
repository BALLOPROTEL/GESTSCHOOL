import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { Public } from "../security/public.decorator";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { RateLimit } from "../security/rate-limit.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import {
  BulkAttendanceDto,
  CreateAttendanceAttachmentDto,
  CreateAttendanceDto,
  NotificationDeliveryEventDto,
  CreateNotificationDto,
  CreateTimetableSlotDto,
  DispatchPendingNotificationsDto,
  UpdateAttendanceDto,
  UpdateAttendanceValidationDto,
  UpdateNotificationStatusDto,
  UpdateTimetableSlotDto
} from "./dto/school-life.dto";
import { SchoolLifeService } from "./school-life.service";

@ApiTags("school-life")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller()
export class SchoolLifeController {
  constructor(
    private readonly schoolLifeService: SchoolLifeService,
    private readonly configService: ConfigService
  ) {}

  @Get("attendance/summary")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendance", "read")
  @ApiOperation({ summary: "Attendance summary dashboard" })
  async attendanceSummary(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.getAttendanceSummary(tenantId, {
      classId,
      fromDate,
      toDate
    });
  }

  @Get("attendance")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendance", "read")
  @ApiOperation({ summary: "List attendance" })
  async listAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("studentId") studentId?: string,
    @Query("status") status?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.listAttendance(tenantId, {
      classId,
      studentId,
      status: status?.trim().toUpperCase(),
      fromDate,
      toDate
    });
  }

  @Post("attendance")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendance", "create")
  @ApiOperation({ summary: "Create attendance" })
  async createAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateAttendanceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.createAttendance(tenantId, body);
  }

  @Post("attendance/bulk")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendance", "create")
  @ApiOperation({ summary: "Bulk create or update attendance" })
  async upsertAttendanceBulk(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: BulkAttendanceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.upsertAttendanceBulk(tenantId, body);
  }

  @Patch("attendance/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendance", "update")
  @ApiOperation({ summary: "Update attendance" })
  async updateAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAttendanceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.updateAttendance(tenantId, id, body);
  }

  @Delete("attendance/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("attendance", "delete")
  @ApiOperation({ summary: "Delete attendance" })
  async deleteAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.schoolLifeService.deleteAttendance(tenantId, id);
  }

  @Get("attendance/:id/attachments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendanceAttachment", "read")
  @ApiOperation({ summary: "List attendance attachments" })
  async listAttendanceAttachments(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.listAttendanceAttachments(tenantId, id);
  }

  @Post("attendance/:id/attachments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("attendanceAttachment", "create")
  @ApiOperation({ summary: "Add attendance attachment" })
  async addAttendanceAttachment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: CreateAttendanceAttachmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.addAttendanceAttachment(
      tenantId,
      id,
      body,
      request.user?.sub
    );
  }

  @Delete("attendance/:attendanceId/attachments/:attachmentId")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("attendanceAttachment", "delete")
  @ApiOperation({ summary: "Delete attendance attachment" })
  async deleteAttendanceAttachment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("attendanceId", new ParseUUIDPipe()) attendanceId: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.schoolLifeService.deleteAttendanceAttachment(tenantId, attendanceId, attachmentId);
  }

  @Patch("attendance/:id/validation")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("attendanceValidation", "validate")
  @ApiOperation({ summary: "Validate attendance justification" })
  async validateAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAttendanceValidationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.updateAttendanceValidation(
      tenantId,
      id,
      body,
      request.user?.sub
    );
  }

  @Get("timetable-slots")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT, UserRole.PARENT)
  @RequirePermission("timetable", "read")
  @ApiOperation({ summary: "List timetable slots" })
  async listTimetableSlots(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("dayOfWeek") dayOfWeek?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.listTimetableSlots(tenantId, {
      classId,
      schoolYearId,
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined
    });
  }

  @Get("timetable-slots/grid")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT, UserRole.PARENT)
  @RequirePermission("timetable", "read")
  @ApiOperation({ summary: "Weekly timetable grouped by day" })
  async timetableGrid(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.getTimetableGrid(tenantId, { classId, schoolYearId });
  }

  @Post("timetable-slots")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("timetable", "create")
  @ApiOperation({ summary: "Create timetable slot" })
  async createTimetableSlot(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTimetableSlotDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.createTimetableSlot(tenantId, body);
  }

  @Patch("timetable-slots/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("timetable", "update")
  @ApiOperation({ summary: "Update timetable slot" })
  async updateTimetableSlot(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTimetableSlotDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.updateTimetableSlot(tenantId, id, body);
  }

  @Delete("timetable-slots/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("timetable", "delete")
  @ApiOperation({ summary: "Delete timetable slot" })
  async deleteTimetableSlot(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.schoolLifeService.deleteTimetableSlot(tenantId, id);
  }

  @Get("notifications")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT, UserRole.COMPTABLE)
  @RequirePermission("notifications", "read")
  @ApiOperation({ summary: "List notifications" })
  async listNotifications(
    @Req() request: { user?: AuthenticatedUser },
    @Query("status") status?: string,
    @Query("channel") channel?: string,
    @Query("audienceRole") audienceRole?: string,
    @Query("studentId") studentId?: string,
    @Query("deliveryStatus") deliveryStatus?: string,
    @Query("provider") provider?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.listNotifications(tenantId, {
      status: status?.trim().toUpperCase(),
      channel: channel?.trim().toUpperCase(),
      audienceRole: audienceRole?.trim().toUpperCase(),
      studentId,
      deliveryStatus: deliveryStatus?.trim().toUpperCase(),
      provider: provider?.trim()
    });
  }

  @Post("notifications")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("notifications", "create")
  @ApiOperation({ summary: "Create notification" })
  async createNotification(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateNotificationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.createNotification(tenantId, body);
  }

  @Public()
  @Post("notifications/delivery-events")
  @RateLimit({ bucket: "notifications-delivery-events", max: 120, windowMs: 60_000 })
  @ApiOperation({ summary: "Provider callback: update notification deliverability status" })
  async recordNotificationDeliveryEvent(
    @Body() body: NotificationDeliveryEventDto,
    @Headers("x-notification-webhook-secret") webhookSecret?: string
  ) {
    const expectedSecret = this.configService
      .get<string>("NOTIFICATION_WEBHOOK_SECRET", "")
      .trim();
    if (!expectedSecret) {
      throw new ForbiddenException("Notification webhook endpoint is disabled.");
    }
    if (!webhookSecret || webhookSecret.trim() !== expectedSecret) {
      throw new ForbiddenException("Invalid notification webhook secret.");
    }
    return this.schoolLifeService.recordDeliveryEvent(body);
  }

  @Post("notifications/dispatch-pending")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("notifications", "dispatch")
  @ApiOperation({ summary: "Dispatch pending/scheduled notifications" })
  async dispatchPendingNotifications(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: DispatchPendingNotificationsDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.dispatchPendingNotifications(tenantId, body.limit);
  }

  @Patch("notifications/:id/status")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("notifications", "update")
  @ApiOperation({ summary: "Update notification status" })
  async updateNotificationStatus(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNotificationStatusDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.schoolLifeService.updateNotificationStatus(tenantId, id, body);
  }

  private getTenantId(user: AuthenticatedUser | undefined, tenantHeader?: string): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
