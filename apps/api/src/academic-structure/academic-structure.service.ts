import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicStage,
  AcademicPlacementStatus,
  AcademicTrack,
  PedagogicalRuleType,
  Prisma,
  ReportCardMode,
  RotationGroup
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type ClassroomContext = Prisma.ClassroomGetPayload<{
  include: {
    level: {
      include: {
        cycle: true;
      };
    };
    schoolYear: true;
  };
}>;

type TrackPlacementView = {
  id: string;
  tenantId: string;
  studentId: string;
  schoolYearId: string;
  track: AcademicTrack;
  levelId: string;
  classId?: string;
  legacyEnrollmentId?: string;
  placementStatus: AcademicPlacementStatus;
  isPrimary: boolean;
  startDate?: string;
  endDate?: string;
  studentName?: string;
  levelCode?: string;
  levelLabel?: string;
  cycleId?: string;
  cycleCode?: string;
  cycleLabel?: string;
  academicStage?: AcademicStage;
  cycleSortOrder?: number;
  levelSortOrder?: number;
  hierarchyRank?: number;
  classLabel?: string;
  schoolYearCode?: string;
};

type PlacementHierarchyView = TrackPlacementView & {
  cycleId: string;
  academicStage: AcademicStage;
  cycleSortOrder: number;
  levelSortOrder: number;
  hierarchyRank: number;
};

type ReportCardStrategyView = {
  mode: ReportCardMode;
  placements: PlacementHierarchyView[];
  primaryPlacement?: PlacementHierarchyView;
  secondaryPlacement?: PlacementHierarchyView;
};

type PlacementHierarchyRow = Prisma.StudentTrackPlacementGetPayload<{
  include: {
    student: true;
    level: {
      include: {
        cycle: true;
      };
    };
    classroom: true;
    schoolYear: true;
  };
}>;

type PedagogicalRuleView = {
  id: string;
  tenantId: string;
  schoolYearId?: string;
  cycleId?: string;
  levelId?: string;
  classId?: string;
  code: string;
  label: string;
  ruleType: PedagogicalRuleType;
  track?: AcademicTrack;
  rotationGroup?: RotationGroup;
  config: Prisma.JsonValue;
  isActive: boolean;
};

type UpsertTrackPlacementPayload = {
  studentId: string;
  schoolYearId: string;
  track?: AcademicTrack | string;
  levelId: string;
  classId?: string;
  legacyEnrollmentId?: string;
  placementStatus?: AcademicPlacementStatus | string;
  isPrimary?: boolean;
  startDate?: string;
  endDate?: string;
};

type CreatePedagogicalRulePayload = {
  schoolYearId?: string;
  cycleId?: string;
  levelId?: string;
  classId?: string;
  code: string;
  label: string;
  ruleType: PedagogicalRuleType | string;
  track?: AcademicTrack | string;
  rotationGroup?: RotationGroup | string;
  config: Prisma.InputJsonValue;
  isActive?: boolean;
};

type TimetableRuleCheckPayload = {
  classId: string;
  dayOfWeek: number;
  startTime: string;
  track?: AcademicTrack | string;
  rotationGroup?: RotationGroup | string;
};

@Injectable()
export class AcademicStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async listTrackPlacements(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      studentId?: string;
      classId?: string;
      levelId?: string;
      track?: string;
    }
  ): Promise<TrackPlacementView[]> {
    const rows = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        studentId: filters.studentId,
        classId: filters.classId,
        levelId: filters.levelId,
        track: filters.track
          ? this.normalizeTrack(filters.track)
          : undefined
      },
      include: {
        student: true,
        level: {
          include: {
            cycle: true
          }
        },
        classroom: true,
        schoolYear: true
      },
      orderBy: [{ schoolYearId: "desc" }, { createdAt: "asc" }]
    });

    return rows.map((row) => this.trackPlacementView(row));
  }

  async upsertTrackPlacement(
    tenantId: string,
    payload: UpsertTrackPlacementPayload,
    options?: {
      syncLegacyEnrollment?: boolean;
      transaction?: Prisma.TransactionClient;
    }
  ): Promise<TrackPlacementView> {
    const client = this.resolveClient(options?.transaction);
    const track = this.normalizeTrack(payload.track);
    const placementStatus = this.normalizePlacementStatus(payload.placementStatus);
    const student = await this.requireStudent(tenantId, payload.studentId, client);
    const schoolYear = await this.requireSchoolYear(tenantId, payload.schoolYearId, client);
    const level = await this.requireLevel(tenantId, payload.levelId, client);

    if (level.track !== track) {
      throw new ConflictException("Level track must match placement track.");
    }

    const classroom = payload.classId
      ? await this.requireClassroomContext(tenantId, payload.classId, client)
      : null;

    if (classroom) {
      if (classroom.schoolYearId !== schoolYear.id) {
        throw new ConflictException("Classroom and school year must match.");
      }
      if (classroom.levelId !== level.id) {
        throw new ConflictException("Classroom and level must match.");
      }
      if (classroom.track !== track) {
        throw new ConflictException("Classroom track must match placement track.");
      }
    }

    const existing = await client.studentTrackPlacement.findFirst({
      where: {
        tenantId,
        schoolYearId: schoolYear.id,
        studentId: student.id,
        track
      }
    });

    let placement = existing
      ? await client.studentTrackPlacement.update({
          where: { id: existing.id },
          data: {
            levelId: level.id,
            classId: classroom?.id || null,
            legacyEnrollmentId: payload.legacyEnrollmentId ?? existing.legacyEnrollmentId,
            placementStatus,
            isPrimary: existing.isPrimary,
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            updatedAt: new Date()
          },
          include: {
            student: true,
            level: {
              include: {
                cycle: true
              }
            },
            classroom: true,
            schoolYear: true
          }
        })
      : await client.studentTrackPlacement.create({
          data: {
            tenantId,
            studentId: student.id,
            schoolYearId: schoolYear.id,
            track,
            levelId: level.id,
            classId: classroom?.id || null,
            legacyEnrollmentId: payload.legacyEnrollmentId,
            placementStatus,
            isPrimary: false,
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            updatedAt: new Date()
          },
          include: {
            student: true,
            level: {
              include: {
                cycle: true
              }
            },
            classroom: true,
            schoolYear: true
          }
        });

    if (options?.syncLegacyEnrollment && classroom) {
      const legacyEnrollment = await client.enrollment.upsert({
        where: {
          tenantId_schoolYearId_studentId_track: {
            tenantId,
            schoolYearId: schoolYear.id,
            studentId: student.id,
            track
          }
        },
        create: {
          tenantId,
          schoolYearId: schoolYear.id,
          studentId: student.id,
          classId: classroom.id,
          track,
          enrollmentDate: payload.startDate
            ? new Date(payload.startDate)
            : new Date(),
          enrollmentStatus: this.toLegacyEnrollmentStatus(placementStatus),
          updatedAt: new Date()
        },
        update: {
          classId: classroom.id,
          track,
          enrollmentDate: payload.startDate
            ? new Date(payload.startDate)
            : undefined,
          enrollmentStatus: this.toLegacyEnrollmentStatus(placementStatus),
          updatedAt: new Date()
        }
      });

      if (placement.legacyEnrollmentId !== legacyEnrollment.id) {
        placement = await client.studentTrackPlacement.update({
          where: { id: placement.id },
          data: {
            legacyEnrollmentId: legacyEnrollment.id,
            updatedAt: new Date()
          },
          include: {
            student: true,
            level: {
              include: {
                cycle: true
              }
            },
            classroom: true,
            schoolYear: true
          }
        });
      }
    }

    await this.rebalanceStudentYearPlacementPriority(
      tenantId,
      student.id,
      schoolYear.id,
      client
    );

    placement = await client.studentTrackPlacement.findFirstOrThrow({
      where: { id: placement.id, tenantId },
      include: {
        student: true,
        level: {
          include: {
            cycle: true
          }
        },
        classroom: true,
        schoolYear: true
      }
    });

    return this.trackPlacementView(placement);
  }

  async deleteTrackPlacement(
    tenantId: string,
    id: string,
    options?: { transaction?: Prisma.TransactionClient; deleteLegacyEnrollment?: boolean }
  ): Promise<void> {
    const client = this.resolveClient(options?.transaction);
    const placement = await client.studentTrackPlacement.findFirst({
      where: { id, tenantId }
    });

    if (!placement) {
      throw new NotFoundException("Track placement not found.");
    }

    const legacyEnrollmentId = placement.legacyEnrollmentId;
    const studentId = placement.studentId;
    const schoolYearId = placement.schoolYearId;
    await client.studentTrackPlacement.delete({ where: { id: placement.id } });

    await this.rebalanceStudentYearPlacementPriority(
      tenantId,
      studentId,
      schoolYearId,
      client
    );

    if (options?.deleteLegacyEnrollment && legacyEnrollmentId) {
      await client.enrollment.deleteMany({
        where: { id: legacyEnrollmentId, tenantId }
      });
    }
  }

  async requirePlacementForStudentClass(
    tenantId: string,
    studentId: string,
    classId: string,
    schoolYearId: string,
    requestedTrack?: string | AcademicTrack,
    transaction?: Prisma.TransactionClient
  ) {
    const client = this.resolveClient(transaction);
    const classroom = await this.requireClassroomContext(tenantId, classId, client);
    if (classroom.schoolYearId !== schoolYearId) {
      throw new ConflictException("Classroom and school year must match.");
    }

    const track = requestedTrack
      ? this.normalizeTrack(requestedTrack)
      : classroom.track;

    const placement = await client.studentTrackPlacement.findFirst({
      where: {
        tenantId,
        studentId,
        schoolYearId,
        classId,
        track,
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      include: {
        student: true,
        level: true,
        classroom: true,
        schoolYear: true
      }
    });

    if (!placement) {
      throw new ConflictException(
        "Student has no track placement in this class for the school year."
      );
    }

    return placement;
  }

  async listPlacementHierarchy(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    transaction?: Prisma.TransactionClient
  ): Promise<PlacementHierarchyView[]> {
    const client = this.resolveClient(transaction);
    const placements = await client.studentTrackPlacement.findMany({
      where: {
        tenantId,
        studentId,
        schoolYearId
      },
      include: {
        student: true,
        level: {
          include: {
            cycle: true
          }
        },
        classroom: true,
        schoolYear: true
      }
    });

    return this.sortPlacementHierarchyRows(placements).map((row) =>
      this.placementHierarchyView(row)
    );
  }

  async resolvePrimarySecondaryPlacements(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    transaction?: Prisma.TransactionClient
  ): Promise<{
    placements: PlacementHierarchyView[];
    primaryPlacement?: PlacementHierarchyView;
    secondaryPlacement?: PlacementHierarchyView;
  }> {
    const placements = await this.listPlacementHierarchy(
      tenantId,
      studentId,
      schoolYearId,
      transaction
    );

    return {
      placements,
      primaryPlacement: placements[0],
      secondaryPlacement: placements[1]
    };
  }

  async resolveReportCardStrategy(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    transaction?: Prisma.TransactionClient
  ): Promise<ReportCardStrategyView> {
    const { placements, primaryPlacement, secondaryPlacement } =
      await this.resolvePrimarySecondaryPlacements(
        tenantId,
        studentId,
        schoolYearId,
        transaction
      );

    const activePlacements = placements.filter(
      (placement) =>
        placement.placementStatus === AcademicPlacementStatus.ACTIVE ||
        placement.placementStatus === AcademicPlacementStatus.COMPLETED
    );
    const scopedPlacements = activePlacements.length > 0 ? activePlacements : placements;
    const shouldCombinePrimary =
      scopedPlacements.length > 1 &&
      scopedPlacements.every(
        (placement) => placement.academicStage === AcademicStage.PRIMARY
      );

    return {
      mode: shouldCombinePrimary
        ? ReportCardMode.PRIMARY_COMBINED
        : ReportCardMode.TRACK_SINGLE,
      placements: scopedPlacements,
      primaryPlacement: scopedPlacements[0] || primaryPlacement,
      secondaryPlacement: scopedPlacements[1] || secondaryPlacement
    };
  }

  async requireClassroomContext(
    tenantId: string,
    classId: string,
    transaction?: Prisma.TransactionClient
  ): Promise<ClassroomContext> {
    const client = this.resolveClient(transaction);
    const classroom = await client.classroom.findFirst({
      where: { id: classId, tenantId },
      include: {
        level: {
          include: {
            cycle: true
          }
        },
        schoolYear: true
      }
    });

    if (!classroom) {
      throw new NotFoundException("Class not found.");
    }

    return classroom;
  }

  async listPedagogicalRules(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      cycleId?: string;
      levelId?: string;
      classId?: string;
      ruleType?: string;
      track?: string;
    } = {}
  ): Promise<PedagogicalRuleView[]> {
    const rows = await this.prisma.pedagogicalRule.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        cycleId: filters.cycleId,
        levelId: filters.levelId,
        classId: filters.classId,
        ruleType: filters.ruleType
          ? this.normalizeRuleType(filters.ruleType)
          : undefined,
        track: filters.track ? this.normalizeTrack(filters.track) : undefined
      },
      orderBy: [{ code: "asc" }]
    });

    return rows.map((row) => this.pedagogicalRuleView(row));
  }

  async createPedagogicalRule(
    tenantId: string,
    payload: CreatePedagogicalRulePayload
  ): Promise<PedagogicalRuleView> {
    if (!payload.schoolYearId && !payload.cycleId && !payload.levelId && !payload.classId) {
      throw new ConflictException(
        "At least one pedagogical scope must be provided."
      );
    }

    if (payload.schoolYearId) {
      await this.requireSchoolYear(tenantId, payload.schoolYearId, this.prisma);
    }
    if (payload.cycleId) {
      await this.requireCycle(tenantId, payload.cycleId, this.prisma);
    }
    if (payload.levelId) {
      await this.requireLevel(tenantId, payload.levelId, this.prisma);
    }
    if (payload.classId) {
      await this.requireClassroomContext(tenantId, payload.classId, this.prisma);
    }

    try {
      const created = await this.prisma.pedagogicalRule.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          cycleId: payload.cycleId,
          levelId: payload.levelId,
          classId: payload.classId,
          code: payload.code.trim().toUpperCase(),
          label: payload.label.trim(),
          ruleType: this.normalizeRuleType(payload.ruleType),
          track: payload.track ? this.normalizeTrack(payload.track) : null,
          rotationGroup: payload.rotationGroup
            ? this.normalizeRotationGroup(payload.rotationGroup)
            : null,
          config: this.normalizeRuleConfig(payload.config),
          isActive: payload.isActive ?? true,
          updatedAt: new Date()
        }
      });

      return this.pedagogicalRuleView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Pedagogical rule code already exists.");
      }
      throw error;
    }
  }

  async deletePedagogicalRule(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.pedagogicalRule.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      throw new NotFoundException("Pedagogical rule not found.");
    }

    await this.prisma.pedagogicalRule.delete({ where: { id } });
  }

  async validateTimetableSlotAgainstPedagogicalRules(
    tenantId: string,
    payload: TimetableRuleCheckPayload
  ): Promise<{
    track: AcademicTrack;
    rotationGroup?: RotationGroup;
  }> {
    const classroom = await this.requireClassroomContext(tenantId, payload.classId);
    const track = payload.track
      ? this.normalizeTrack(payload.track)
      : classroom.track;
    if (track !== classroom.track) {
      throw new ConflictException("Timetable slot track must match classroom track.");
    }

    const rotationGroup =
      payload.rotationGroup
        ? this.normalizeRotationGroup(payload.rotationGroup)
        : classroom.rotationGroup || classroom.level.rotationGroup || undefined;

    const rules = await this.prisma.pedagogicalRule.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { classId: classroom.id },
          { levelId: classroom.levelId, classId: null },
          { cycleId: classroom.level.cycleId, levelId: null, classId: null }
        ],
        AND: [
          {
            OR: [
              { schoolYearId: null },
              { schoolYearId: classroom.schoolYearId }
            ]
          }
        ]
      }
    });

    for (const rule of rules) {
      if (rule.track && rule.track !== track) {
        continue;
      }
      if (rule.rotationGroup && rotationGroup && rule.rotationGroup !== rotationGroup) {
        continue;
      }

      if (rule.ruleType === PedagogicalRuleType.SECOND_CYCLE_WEEKLY_TRACK_SPLIT) {
        this.validateWeeklyTrackRule(rule.config, track, payload.dayOfWeek, rule.label);
      }

      if (rule.ruleType === PedagogicalRuleType.FIRST_CYCLE_PARALLEL_ROTATION) {
        this.validateParallelRotationRule(
          rule.config,
          track,
          rotationGroup,
          payload.startTime,
          rule.label
        );
      }
    }

    return { track, rotationGroup };
  }

  private async rebalanceStudentYearPlacementPriority(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    client: PrismaClientLike
  ): Promise<void> {
    const placements = await client.studentTrackPlacement.findMany({
      where: {
        tenantId,
        studentId,
        schoolYearId
      },
      include: {
        student: true,
        level: {
          include: {
            cycle: true
          }
        },
        classroom: true,
        schoolYear: true
      }
    });

    if (placements.length === 0) {
      return;
    }

    const sortedPlacements = this.sortPlacementHierarchyRows(placements);
    const primaryPlacementId = sortedPlacements[0]?.id;

    await Promise.all(
      sortedPlacements.map((placement) =>
        client.studentTrackPlacement.update({
          where: { id: placement.id },
          data: {
            isPrimary: placement.id === primaryPlacementId,
            updatedAt: new Date()
          }
        })
      )
    );
  }

  normalizeTrack(value?: string | AcademicTrack | null): AcademicTrack {
    const normalized = (value || "FRANCOPHONE").toString().trim().toUpperCase();
    if (normalized === "AR" || normalized === "ARABOPHONE") {
      return AcademicTrack.ARABOPHONE;
    }
    return AcademicTrack.FRANCOPHONE;
  }

  normalizeRotationGroup(value?: string | RotationGroup | null): RotationGroup {
    const normalized = (value || "").toString().trim().toUpperCase();
    if (normalized === "B" || normalized === "GROUP_B") {
      return RotationGroup.GROUP_B;
    }
    return RotationGroup.GROUP_A;
  }

  normalizePlacementStatus(
    value?: string | AcademicPlacementStatus | null
  ): AcademicPlacementStatus {
    const normalized = (value || AcademicPlacementStatus.ACTIVE)
      .toString()
      .trim()
      .toUpperCase();

    if (normalized === "INACTIVE") return AcademicPlacementStatus.INACTIVE;
    if (normalized === "COMPLETED") return AcademicPlacementStatus.COMPLETED;
    if (normalized === "SUSPENDED") return AcademicPlacementStatus.SUSPENDED;
    return AcademicPlacementStatus.ACTIVE;
  }

  private normalizeRuleType(
    value: string | PedagogicalRuleType
  ): PedagogicalRuleType {
    const normalized = value.toString().trim().toUpperCase();
    if (normalized === "SECOND_CYCLE_WEEKLY_TRACK_SPLIT") {
      return PedagogicalRuleType.SECOND_CYCLE_WEEKLY_TRACK_SPLIT;
    }
    return PedagogicalRuleType.FIRST_CYCLE_PARALLEL_ROTATION;
  }

  private normalizeRuleConfig(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
    if (value && typeof value === "object") {
      return value;
    }
    return {};
  }

  private toLegacyEnrollmentStatus(
    placementStatus: AcademicPlacementStatus
  ): string {
    if (placementStatus === AcademicPlacementStatus.INACTIVE) {
      return "INACTIVE";
    }
    if (placementStatus === AcademicPlacementStatus.COMPLETED) {
      return "COMPLETED";
    }
    if (placementStatus === AcademicPlacementStatus.SUSPENDED) {
      return "SUSPENDED";
    }
    return "ENROLLED";
  }

  private validateWeeklyTrackRule(
    config: Prisma.JsonValue,
    track: AcademicTrack,
    dayOfWeek: number,
    ruleLabel: string
  ): void {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return;
    }

    const daysByTrack = (config as Record<string, unknown>).daysByTrack;
    if (!daysByTrack || typeof daysByTrack !== "object" || Array.isArray(daysByTrack)) {
      return;
    }

    const allowedDays = (daysByTrack as Record<string, unknown>)[track];
    if (!Array.isArray(allowedDays) || allowedDays.length === 0) {
      return;
    }

    const normalizedDays = allowedDays
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

    if (normalizedDays.length > 0 && !normalizedDays.includes(dayOfWeek)) {
      throw new ConflictException(
        `Timetable slot violates pedagogical rule "${ruleLabel}" for ${track}.`
      );
    }
  }

  private validateParallelRotationRule(
    config: Prisma.JsonValue,
    track: AcademicTrack,
    rotationGroup: RotationGroup | undefined,
    startTime: string,
    ruleLabel: string
  ): void {
    if (!rotationGroup) {
      return;
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return;
    }

    const schedule = (config as Record<string, unknown>).schedule;
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
      return;
    }

    const halfDayKey =
      this.parseTimeToMinutes(startTime) < 12 * 60 ? "MORNING" : "AFTERNOON";
    const halfDaySchedule = (schedule as Record<string, unknown>)[halfDayKey];
    if (
      !halfDaySchedule ||
      typeof halfDaySchedule !== "object" ||
      Array.isArray(halfDaySchedule)
    ) {
      return;
    }

    const expectedTrack = (halfDaySchedule as Record<string, unknown>)[rotationGroup];
    if (!expectedTrack) {
      return;
    }

    if (this.normalizeTrack(expectedTrack as string) !== track) {
      throw new ConflictException(
        `Timetable slot violates pedagogical rule "${ruleLabel}" for ${rotationGroup}.`
      );
    }
  }

  private parseTimeToMinutes(value: string): number {
    const [hour, minute] = value.split(":").map((item) => Number(item));
    return hour * 60 + minute;
  }

  private sortPlacementHierarchyRows(
    rows: PlacementHierarchyRow[]
  ): PlacementHierarchyRow[] {
    return [...rows].sort((left, right) => {
      const statusDelta =
        this.getPlacementStatusPriority(right.placementStatus) -
        this.getPlacementStatusPriority(left.placementStatus);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const rankDelta =
        this.getPlacementHierarchyRank(right) - this.getPlacementHierarchyRank(left);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      const leftStartDate = left.startDate?.getTime() || 0;
      const rightStartDate = right.startDate?.getTime() || 0;
      if (leftStartDate !== rightStartDate) {
        return leftStartDate - rightStartDate;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  private getPlacementStatusPriority(status: AcademicPlacementStatus): number {
    switch (status) {
      case AcademicPlacementStatus.ACTIVE:
        return 40;
      case AcademicPlacementStatus.SUSPENDED:
        return 30;
      case AcademicPlacementStatus.COMPLETED:
        return 20;
      case AcademicPlacementStatus.INACTIVE:
      default:
        return 10;
    }
  }

  private getPlacementHierarchyRank(row: PlacementHierarchyRow): number {
    return (
      this.getAcademicStagePriority(row.level.cycle.academicStage) * 1_000_000 +
      row.level.cycle.sortOrder * 1_000 +
      row.level.sortOrder
    );
  }

  private getAcademicStagePriority(stage: AcademicStage): number {
    switch (stage) {
      case AcademicStage.HIGHER:
        return 30;
      case AcademicStage.SECONDARY:
        return 20;
      case AcademicStage.PRIMARY:
      default:
        return 10;
    }
  }

  private async requireStudent(
    tenantId: string,
    studentId: string,
    client: PrismaClientLike
  ) {
    const student = await client.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        deletedAt: null
      }
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return student;
  }

  private async requireSchoolYear(
    tenantId: string,
    schoolYearId: string,
    client: PrismaClientLike
  ) {
    const schoolYear = await client.schoolYear.findFirst({
      where: { id: schoolYearId, tenantId }
    });

    if (!schoolYear) {
      throw new NotFoundException("School year not found.");
    }

    return schoolYear;
  }

  private async requireCycle(
    tenantId: string,
    cycleId: string,
    client: PrismaClientLike
  ) {
    const cycle = await client.cycle.findFirst({
      where: { id: cycleId, tenantId }
    });

    if (!cycle) {
      throw new NotFoundException("Cycle not found.");
    }

    return cycle;
  }

  private async requireLevel(
    tenantId: string,
    levelId: string,
    client: PrismaClientLike
  ) {
    const level = await client.level.findFirst({
      where: { id: levelId, tenantId }
    });

    if (!level) {
      throw new NotFoundException("Level not found.");
    }

    return level;
  }

  private resolveClient(
    transaction?: Prisma.TransactionClient
  ): PrismaClientLike {
    return transaction || this.prisma;
  }

  private trackPlacementView(
    row: PlacementHierarchyRow
  ): TrackPlacementView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      schoolYearId: row.schoolYearId,
      track: row.track,
      levelId: row.levelId,
      classId: row.classId || undefined,
      legacyEnrollmentId: row.legacyEnrollmentId || undefined,
      placementStatus: row.placementStatus,
      isPrimary: row.isPrimary,
      startDate: row.startDate?.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10),
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      levelCode: row.level?.code,
      levelLabel: row.level?.label,
      cycleId: row.level?.cycleId,
      cycleCode: row.level?.cycle?.code,
      cycleLabel: row.level?.cycle?.label,
      academicStage: row.level?.cycle?.academicStage,
      cycleSortOrder: row.level?.cycle?.sortOrder,
      levelSortOrder: row.level?.sortOrder,
      hierarchyRank: this.getPlacementHierarchyRank(row),
      classLabel: row.classroom?.label,
      schoolYearCode: row.schoolYear?.code
    };
  }

  private placementHierarchyView(row: PlacementHierarchyRow): PlacementHierarchyView {
    const view = this.trackPlacementView(row);
    return {
      ...view,
      cycleId: row.level.cycleId,
      academicStage: row.level.cycle.academicStage,
      cycleSortOrder: row.level.cycle.sortOrder,
      levelSortOrder: row.level.sortOrder,
      hierarchyRank: this.getPlacementHierarchyRank(row)
    };
  }

  private pedagogicalRuleView(
    row: Prisma.PedagogicalRuleGetPayload<Record<string, never>>
  ): PedagogicalRuleView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId || undefined,
      cycleId: row.cycleId || undefined,
      levelId: row.levelId || undefined,
      classId: row.classId || undefined,
      code: row.code,
      label: row.label,
      ruleType: row.ruleType,
      track: row.track || undefined,
      rotationGroup: row.rotationGroup || undefined,
      config: row.config,
      isActive: row.isActive
    };
  }
}
