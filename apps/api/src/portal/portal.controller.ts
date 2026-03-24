import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { CreateGradeDto } from "../grades/dto/grades.dto";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { BulkAttendanceDto } from "../school-life/dto/school-life.dto";
import { CreateTeacherNotificationDto } from "./dto/create-teacher-notification.dto";
import { PortalService } from "./portal.service";

@ApiTags("portal")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant header (cannot override authenticated tenant)."
})
@Controller("portal")
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly configService: ConfigService
  ) {}

  @Get("teacher/overview")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher portal KPI overview (scoped by assignments)" })
  async teacherOverview(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.getTeacherOverview(tenantId, this.getUserId(request.user));
  }

  @Get("teacher/classes")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher assigned classes" })
  async teacherClasses(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listTeacherClasses(tenantId, this.getUserId(request.user));
  }

  @Get("teacher/students")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher students list (scoped to assigned classes)" })
  async teacherStudents(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listTeacherStudents(
      tenantId,
      this.getUserId(request.user),
      classId
    );
  }

  @Get("teacher/grades")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher grades list (scoped to assigned classes)" })
  async teacherGrades(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("academicPeriodId") academicPeriodId?: string,
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listTeacherGrades(tenantId, this.getUserId(request.user), {
      classId,
      subjectId,
      academicPeriodId,
      studentId
    });
  }

  @Post("teacher/grades")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "create")
  @ApiOperation({ summary: "Teacher create/update grade (assignment restricted)" })
  async teacherUpsertGrade(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateGradeDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.upsertTeacherGrade(tenantId, this.getUserId(request.user), body);
  }

  @Post("teacher/attendance/bulk")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "create")
  @ApiOperation({ summary: "Teacher bulk attendance (assignment restricted)" })
  async teacherBulkAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: BulkAttendanceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.bulkUpsertTeacherAttendance(
      tenantId,
      this.getUserId(request.user),
      body
    );
  }

  @Get("teacher/timetable")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher timetable (scoped to assigned classes)" })
  async teacherTimetable(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("dayOfWeek") dayOfWeek?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listTeacherTimetable(tenantId, this.getUserId(request.user), {
      classId,
      schoolYearId,
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined
    });
  }

  @Get("teacher/notifications")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "read")
  @ApiOperation({ summary: "Teacher notifications + parent notifications for assigned students" })
  async teacherNotifications(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listTeacherNotifications(
      tenantId,
      this.getUserId(request.user),
      classId
    );
  }

  @Post("teacher/notifications")
  @Roles(UserRole.ENSEIGNANT)
  @RequirePermission("teacherPortal", "create")
  @ApiOperation({ summary: "Teacher send/schedule notification to parents" })
  async teacherCreateNotification(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherNotificationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.createTeacherNotification(
      tenantId,
      this.getUserId(request.user),
      body
    );
  }

  @Get("parent/overview")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent portal KPI overview (scoped by linked children)" })
  async parentOverview(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.getParentOverview(tenantId, this.getUserId(request.user));
  }

  @Get("parent/children")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Children linked to authenticated parent account" })
  async parentChildren(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentChildren(tenantId, this.getUserId(request.user));
  }

  @Get("parent/grades")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent grades (children only)" })
  async parentGrades(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Query("academicPeriodId") academicPeriodId?: string,
    @Query("classId") classId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentGrades(tenantId, this.getUserId(request.user), {
      studentId,
      academicPeriodId,
      classId
    });
  }

  @Get("parent/report-cards")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent report cards (children only)" })
  async parentReportCards(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Query("academicPeriodId") academicPeriodId?: string,
    @Query("classId") classId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentReportCards(tenantId, this.getUserId(request.user), {
      studentId,
      academicPeriodId,
      classId
    });
  }

  @Get("parent/attendance")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent attendance history (children only)" })
  async parentAttendance(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Query("classId") classId?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentAttendance(tenantId, this.getUserId(request.user), {
      studentId,
      classId,
      fromDate,
      toDate
    });
  }

  @Get("parent/invoices")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent invoices (children only)" })
  async parentInvoices(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentInvoices(tenantId, this.getUserId(request.user), studentId);
  }

  @Get("parent/payments")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent payments (children only)" })
  async parentPayments(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentPayments(tenantId, this.getUserId(request.user), studentId);
  }

  @Get("parent/timetable")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent timetable by child (children only)" })
  async parentTimetable(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentTimetable(tenantId, this.getUserId(request.user), studentId);
  }

  @Get("parent/notifications")
  @Roles(UserRole.PARENT)
  @RequirePermission("parentPortal", "read")
  @ApiOperation({ summary: "Parent notifications (children only)" })
  async parentNotifications(
    @Req() request: { user?: AuthenticatedUser },
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.portalService.listParentNotifications(
      tenantId,
      this.getUserId(request.user),
      studentId
    );
  }

  private getUserId(user: AuthenticatedUser | undefined): string {
    if (!user?.sub) {
      throw new BadRequestException("Missing authenticated user context.");
    }
    return user.sub;
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
