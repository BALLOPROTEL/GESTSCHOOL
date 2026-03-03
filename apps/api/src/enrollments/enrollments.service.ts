import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type Enrollment } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";

type EnrollmentView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  studentId: string;
  classId: string;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
};

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService
  ) {}

  async list(
    tenantId: string,
    filters: { schoolYearId?: string; classId?: string; studentId?: string }
  ): Promise<EnrollmentView[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        classId: filters.classId,
        studentId: filters.studentId
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true
      },
      orderBy: [{ enrollmentDate: "desc" }]
    });

    return rows.map((row) => this.toView(row));
  }

  async create(
    tenantId: string,
    payload: CreateEnrollmentDto
  ): Promise<EnrollmentView> {
    await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);
    await this.referenceService.requireClassroom(tenantId, payload.classId);

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

    try {
      const created = await this.prisma.enrollment.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          studentId: payload.studentId,
          classId: payload.classId,
          enrollmentDate: new Date(payload.enrollmentDate),
          enrollmentStatus:
            payload.enrollmentStatus?.trim().toUpperCase() || "ENROLLED",
          updatedAt: new Date()
        },
        include: {
          student: true,
          classroom: true,
          schoolYear: true
        }
      });

      return this.toView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This student already has an enrollment for this school year."
        );
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.enrollment.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException("Enrollment not found.");
    }

    await this.prisma.enrollment.delete({ where: { id } });
  }

  private toView(
    row: Enrollment & {
      student?: { firstName: string; lastName: string } | null;
      classroom?: { label: string } | null;
      schoolYear?: { code: string } | null;
    }
  ): EnrollmentView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      studentId: row.studentId,
      classId: row.classId,
      enrollmentDate: row.enrollmentDate.toISOString().slice(0, 10),
      enrollmentStatus: row.enrollmentStatus,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classLabel: row.classroom?.label,
      schoolYearCode: row.schoolYear?.code
    };
  }
}
