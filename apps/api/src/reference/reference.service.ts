import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type AcademicPeriod, type Classroom, type Cycle, type Level, type SchoolYear, type Subject } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CreateAcademicPeriodDto,
  CreateClassroomDto,
  CreateCycleDto,
  CreateLevelDto,
  CreateSchoolYearDto,
  CreateSubjectDto,
  UpdateAcademicPeriodDto,
  UpdateClassroomDto,
  UpdateCycleDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateSubjectDto
} from "./dto/reference.dto";

type SchoolYearView = {
  id: string;
  tenantId: string;
  code: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type CycleView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  sortOrder: number;
};

type LevelView = {
  id: string;
  tenantId: string;
  cycleId: string;
  code: string;
  label: string;
  sortOrder: number;
};

type ClassroomView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  levelId: string;
  code: string;
  label: string;
  capacity?: number;
};

type SubjectView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  isArabic: boolean;
};

type AcademicPeriodView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  periodType: string;
};

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async listSchoolYears(tenantId: string): Promise<SchoolYearView[]> {
    const rows = await this.prisma.schoolYear.findMany({
      where: { tenantId },
      orderBy: [{ startDate: "desc" }, { code: "desc" }]
    });
    return rows.map((row) => this.schoolYearView(row));
  }

  async createSchoolYear(
    tenantId: string,
    payload: CreateSchoolYearDto
  ): Promise<SchoolYearView> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (payload.isActive) {
          await tx.schoolYear.updateMany({
            where: { tenantId },
            data: { isActive: false, updatedAt: new Date() }
          });
        }

        return tx.schoolYear.create({
          data: {
            tenantId,
            code: payload.code.trim(),
            startDate: new Date(payload.startDate),
            endDate: new Date(payload.endDate),
            isActive: payload.isActive ?? false,
            updatedAt: new Date()
          }
        });
      });

      return this.schoolYearView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async updateSchoolYear(
    tenantId: string,
    id: string,
    payload: UpdateSchoolYearDto
  ): Promise<SchoolYearView> {
    const existing = await this.requireSchoolYear(tenantId, id);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (payload.isActive) {
          await tx.schoolYear.updateMany({
            where: { tenantId, id: { not: existing.id } },
            data: { isActive: false, updatedAt: new Date() }
          });
        }

        return tx.schoolYear.update({
          where: { id: existing.id },
          data: {
            code: payload.code?.trim(),
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            isActive: payload.isActive,
            updatedAt: new Date()
          }
        });
      });

      return this.schoolYearView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async deleteSchoolYear(tenantId: string, id: string): Promise<void> {
    await this.requireSchoolYear(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.schoolYear.delete({ where: { id } }),
      "School year cannot be deleted because it is still used."
    );
  }

  async listCycles(tenantId: string): Promise<CycleView[]> {
    const rows = await this.prisma.cycle.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => this.cycleView(row));
  }

  async createCycle(tenantId: string, payload: CreateCycleDto): Promise<CycleView> {
    try {
      const created = await this.prisma.cycle.create({
        data: {
          tenantId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          sortOrder: payload.sortOrder,
          updatedAt: new Date()
        }
      });
      return this.cycleView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Cycle code already exists.");
      throw error;
    }
  }

  async updateCycle(
    tenantId: string,
    id: string,
    payload: UpdateCycleDto
  ): Promise<CycleView> {
    await this.requireCycle(tenantId, id);
    try {
      const updated = await this.prisma.cycle.update({
        where: { id },
        data: {
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          sortOrder: payload.sortOrder,
          updatedAt: new Date()
        }
      });
      return this.cycleView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Cycle code already exists.");
      throw error;
    }
  }

  async deleteCycle(tenantId: string, id: string): Promise<void> {
    await this.requireCycle(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.cycle.delete({ where: { id } }),
      "Cycle cannot be deleted because it is still used."
    );
  }

  async listLevels(tenantId: string, cycleId?: string): Promise<LevelView[]> {
    const rows = await this.prisma.level.findMany({
      where: {
        tenantId,
        cycleId
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => this.levelView(row));
  }

  async createLevel(tenantId: string, payload: CreateLevelDto): Promise<LevelView> {
    await this.requireCycle(tenantId, payload.cycleId);

    try {
      const created = await this.prisma.level.create({
        data: {
          tenantId,
          cycleId: payload.cycleId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          sortOrder: payload.sortOrder,
          updatedAt: new Date()
        }
      });
      return this.levelView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Level code already exists.");
      throw error;
    }
  }

  async updateLevel(
    tenantId: string,
    id: string,
    payload: UpdateLevelDto
  ): Promise<LevelView> {
    await this.requireLevel(tenantId, id);
    if (payload.cycleId) {
      await this.requireCycle(tenantId, payload.cycleId);
    }

    try {
      const updated = await this.prisma.level.update({
        where: { id },
        data: {
          cycleId: payload.cycleId,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          sortOrder: payload.sortOrder,
          updatedAt: new Date()
        }
      });
      return this.levelView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Level code already exists.");
      throw error;
    }
  }

  async deleteLevel(tenantId: string, id: string): Promise<void> {
    await this.requireLevel(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.level.delete({ where: { id } }),
      "Level cannot be deleted because it is still used."
    );
  }

  async listClassrooms(
    tenantId: string,
    filters: { schoolYearId?: string; levelId?: string }
  ): Promise<ClassroomView[]> {
    const rows = await this.prisma.classroom.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        levelId: filters.levelId
      },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => this.classroomView(row));
  }

  async createClassroom(
    tenantId: string,
    payload: CreateClassroomDto
  ): Promise<ClassroomView> {
    await this.requireSchoolYear(tenantId, payload.schoolYearId);
    await this.requireLevel(tenantId, payload.levelId);

    try {
      const created = await this.prisma.classroom.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          capacity: payload.capacity,
          updatedAt: new Date()
        }
      });
      return this.classroomView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Class code already exists for this school year."
      );
      throw error;
    }
  }

  async updateClassroom(
    tenantId: string,
    id: string,
    payload: UpdateClassroomDto
  ): Promise<ClassroomView> {
    await this.requireClassroom(tenantId, id);
    if (payload.schoolYearId) {
      await this.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    if (payload.levelId) {
      await this.requireLevel(tenantId, payload.levelId);
    }

    try {
      const updated = await this.prisma.classroom.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          capacity: payload.capacity,
          updatedAt: new Date()
        }
      });
      return this.classroomView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Class code already exists for this school year."
      );
      throw error;
    }
  }

  async deleteClassroom(tenantId: string, id: string): Promise<void> {
    await this.requireClassroom(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.classroom.delete({ where: { id } }),
      "Class cannot be deleted because it is still used."
    );
  }

  async listSubjects(tenantId: string): Promise<SubjectView[]> {
    const rows = await this.prisma.subject.findMany({
      where: { tenantId },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => this.subjectView(row));
  }

  async createSubject(
    tenantId: string,
    payload: CreateSubjectDto
  ): Promise<SubjectView> {
    try {
      const created = await this.prisma.subject.create({
        data: {
          tenantId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          isArabic: payload.isArabic ?? false,
          updatedAt: new Date()
        }
      });
      return this.subjectView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Subject code already exists.");
      throw error;
    }
  }

  async updateSubject(
    tenantId: string,
    id: string,
    payload: UpdateSubjectDto
  ): Promise<SubjectView> {
    await this.requireSubject(tenantId, id);
    try {
      const updated = await this.prisma.subject.update({
        where: { id },
        data: {
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          isArabic: payload.isArabic,
          updatedAt: new Date()
        }
      });
      return this.subjectView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Subject code already exists.");
      throw error;
    }
  }

  async deleteSubject(tenantId: string, id: string): Promise<void> {
    await this.requireSubject(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.subject.delete({ where: { id } }),
      "Subject cannot be deleted because it is still used."
    );
  }

  async listAcademicPeriods(
    tenantId: string,
    schoolYearId?: string
  ): Promise<AcademicPeriodView[]> {
    const rows = await this.prisma.academicPeriod.findMany({
      where: {
        tenantId,
        schoolYearId
      },
      orderBy: [{ startDate: "asc" }]
    });
    return rows.map((row) => this.academicPeriodView(row));
  }

  async createAcademicPeriod(
    tenantId: string,
    payload: CreateAcademicPeriodDto
  ): Promise<AcademicPeriodView> {
    await this.requireSchoolYear(tenantId, payload.schoolYearId);
    try {
      const created = await this.prisma.academicPeriod.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          startDate: new Date(payload.startDate),
          endDate: new Date(payload.endDate),
          periodType: payload.periodType.trim().toUpperCase(),
          updatedAt: new Date()
        }
      });
      return this.academicPeriodView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Academic period code already exists for this school year."
      );
      throw error;
    }
  }

  async updateAcademicPeriod(
    tenantId: string,
    id: string,
    payload: UpdateAcademicPeriodDto
  ): Promise<AcademicPeriodView> {
    await this.requireAcademicPeriod(tenantId, id);
    if (payload.schoolYearId) {
      await this.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    try {
      const updated = await this.prisma.academicPeriod.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          startDate: payload.startDate ? new Date(payload.startDate) : undefined,
          endDate: payload.endDate ? new Date(payload.endDate) : undefined,
          periodType: payload.periodType?.trim().toUpperCase(),
          updatedAt: new Date()
        }
      });
      return this.academicPeriodView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Academic period code already exists for this school year."
      );
      throw error;
    }
  }

  async deleteAcademicPeriod(tenantId: string, id: string): Promise<void> {
    await this.requireAcademicPeriod(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.academicPeriod.delete({ where: { id } }),
      "Academic period cannot be deleted because it is still used."
    );
  }

  async requireSchoolYear(tenantId: string, id: string): Promise<SchoolYear> {
    const row = await this.prisma.schoolYear.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("School year not found.");
    }
    return row;
  }

  async requireCycle(tenantId: string, id: string): Promise<Cycle> {
    const row = await this.prisma.cycle.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Cycle not found.");
    }
    return row;
  }

  async requireLevel(tenantId: string, id: string): Promise<Level> {
    const row = await this.prisma.level.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Level not found.");
    }
    return row;
  }

  async requireClassroom(tenantId: string, id: string): Promise<Classroom> {
    const row = await this.prisma.classroom.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Class not found.");
    }
    return row;
  }

  async requireSubject(tenantId: string, id: string): Promise<Subject> {
    const row = await this.prisma.subject.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Subject not found.");
    }
    return row;
  }

  async requireAcademicPeriod(
    tenantId: string,
    id: string
  ): Promise<AcademicPeriod> {
    const row = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Academic period not found.");
    }
    return row;
  }

  private schoolYearView(row: SchoolYear): SchoolYearView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      isActive: row.isActive
    };
  }

  private cycleView(row: Cycle): CycleView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder
    };
  }

  private levelView(row: Level): LevelView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      cycleId: row.cycleId,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder
    };
  }

  private classroomView(row: Classroom): ClassroomView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      levelId: row.levelId,
      code: row.code,
      label: row.label,
      capacity: row.capacity === null ? undefined : row.capacity
    };
  }

  private subjectView(row: Subject): SubjectView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      label: row.label,
      isArabic: row.isArabic
    };
  }

  private academicPeriodView(row: AcademicPeriod): AcademicPeriodView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      code: row.code,
      label: row.label,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      periodType: row.periodType
    };
  }

  private handleKnownPrismaError(error: unknown, conflictMessage: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(conflictMessage);
    }
  }

  private async deleteEntity(
    callback: () => Promise<unknown>,
    relationErrorMessage: string
  ): Promise<void> {
    try {
      await callback();
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ConflictException(relationErrorMessage);
      }
      throw error;
    }
  }
}
