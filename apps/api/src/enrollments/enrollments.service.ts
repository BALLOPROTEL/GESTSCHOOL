import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AcademicTrack, type Enrollment } from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  CreateEnrollmentDto,
  CreateStudentTrackPlacementDto
} from "./dto/create-enrollment.dto";

type EnrollmentView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  studentId: string;
  classId: string;
  track: AcademicTrack;
  placementId?: string;
  isPrimary?: boolean;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
  primaryClassLabel?: string;
  secondaryClassLabel?: string;
  primaryTrack?: AcademicTrack;
  secondaryTrack?: AcademicTrack;
};

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly academicStructureService: AcademicStructureService
  ) {}

  async list(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      classId?: string;
      studentId?: string;
      track?: string;
    }
  ): Promise<EnrollmentView[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        classId: filters.classId,
        studentId: filters.studentId,
        track: filters.track
          ? this.academicStructureService.normalizeTrack(filters.track)
          : undefined
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        placement: true
      },
      orderBy: [{ enrollmentDate: "desc" }]
    });

    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async create(
    tenantId: string,
    payload: CreateEnrollmentDto
  ): Promise<EnrollmentView> {
    await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);

    const student = await this.prisma.student.findFirst({
      where: {
        id: payload.studentId,
        tenantId,
        deletedAt: null
      }
    });
    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const placement = await this.academicStructureService.upsertTrackPlacement(
      tenantId,
      {
        studentId: payload.studentId,
        schoolYearId: payload.schoolYearId,
        track: payload.track || classroom.track,
        levelId: classroom.levelId,
        classId: payload.classId,
        placementStatus: payload.enrollmentStatus || "ACTIVE",
        startDate: payload.enrollmentDate
      },
      { syncLegacyEnrollment: true }
    );

    const created = await this.prisma.enrollment.findFirst({
      where: {
        tenantId,
        id: placement.legacyEnrollmentId
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        placement: true
      }
    });

    if (!created) {
      throw new ConflictException("Legacy enrollment could not be synchronized.");
    }

    return this.toView(created);
  }

  async listPlacements(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      studentId?: string;
      classId?: string;
      levelId?: string;
      track?: string;
    }
  ) {
    return this.academicStructureService.listTrackPlacements(tenantId, filters);
  }

  async createPlacement(
    tenantId: string,
    payload: CreateStudentTrackPlacementDto
  ) {
    return this.academicStructureService.upsertTrackPlacement(
      tenantId,
      payload,
      { syncLegacyEnrollment: Boolean(payload.classId) }
    );
  }

  async removePlacement(tenantId: string, id: string): Promise<void> {
    await this.academicStructureService.deleteTrackPlacement(tenantId, id, {
      deleteLegacyEnrollment: true
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.enrollment.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException("Enrollment not found.");
    }

    await this.prisma.$transaction(async (transaction) => {
      const placement = await transaction.studentTrackPlacement.findFirst({
        where: {
          tenantId,
          legacyEnrollmentId: existing.id
        }
      });

      if (placement) {
        await transaction.studentTrackPlacement.delete({
          where: { id: placement.id }
        });
      }

      await transaction.enrollment.delete({ where: { id } });
    });
  }

  private async toView(
    row: Enrollment & {
      student?: { firstName: string; lastName: string } | null;
      classroom?: { label: string } | null;
      schoolYear?: { code: string } | null;
      placement?: { id: string } | null;
    }
  ): Promise<EnrollmentView> {
    const placementContext =
      await this.academicStructureService.resolvePrimarySecondaryPlacements(
        row.tenantId,
        row.studentId,
        row.schoolYearId
      );
    const linkedPlacement =
      placementContext.placements.find(
        (placement) => placement.id === row.placement?.id
      ) ||
      placementContext.placements.find((placement) => placement.track === row.track);

    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      studentId: row.studentId,
      classId: row.classId,
      track: row.track,
      placementId: row.placement?.id,
      isPrimary: linkedPlacement?.isPrimary,
      enrollmentDate: row.enrollmentDate.toISOString().slice(0, 10),
      enrollmentStatus: row.enrollmentStatus,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classLabel: row.classroom?.label,
      schoolYearCode: row.schoolYear?.code,
      primaryClassLabel: placementContext.primaryPlacement?.classLabel,
      secondaryClassLabel: placementContext.secondaryPlacement?.classLabel,
      primaryTrack: placementContext.primaryPlacement?.track,
      secondaryTrack: placementContext.secondaryPlacement?.track
    };
  }
}
