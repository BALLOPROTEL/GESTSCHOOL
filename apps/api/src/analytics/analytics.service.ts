import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type IamAuditLog, type User } from "@prisma/client";

import { buildExcelXml, buildTablePdf, toDataUrl } from "../common/export.util";
import { PrismaService } from "../database/prisma.service";
import {
  type AnalyticsOverviewQueryDto,
  type AuditLogExportQueryDto,
  type AuditLogQueryDto
} from "./dto/analytics.dto";

type MonthlyPoint = {
  bucket: string;
  label: string;
  value: number;
};

export type AnalyticsOverviewView = {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  students: {
    total: number;
    active: number;
    createdInWindow: number;
  };
  academics: {
    schoolYears: number;
    classes: number;
    subjects: number;
    activeEnrollments: number;
  };
  finance: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
    paymentsInWindow: number;
    overdueInvoices: number;
  };
  schoolLife: {
    attendanceEntries: number;
    absences: number;
    justifiedAbsences: number;
    justificationRatePercent: number;
    notificationsQueued: number;
    notificationsFailed: number;
  };
  mosque: {
    members: number;
    activeMembers: number;
    activitiesInWindow: number;
    donationsInWindow: number;
    donationsCountInWindow: number;
  };
  trends: {
    payments: MonthlyPoint[];
    donations: MonthlyPoint[];
    absences: MonthlyPoint[];
  };
};

export type AuditLogItemView = {
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  username?: string;
  payload?: unknown;
  payloadPreview?: string;
};

export type AuditLogPageView = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AuditLogItemView[];
};

export type AuditLogExportView = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

type AuditLogWithUser = IamAuditLog & {
  user?: Pick<User, "id" | "username"> | null;
};

@Injectable()
export class AnalyticsService {
  private readonly overviewCache = new Map<
    string,
    { expiresAt: number; value: AnalyticsOverviewView }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async getOverview(
    tenantId: string,
    query: AnalyticsOverviewQueryDto
  ): Promise<AnalyticsOverviewView> {
    const range = this.resolveRange(query.from, query.to);
    const cacheKey = [tenantId, query.schoolYearId || "all", range.from, range.to].join("|");
    const cached = this.overviewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const periodStart = new Date(`${range.from}T00:00:00.000Z`);
    const periodEnd = new Date(`${range.to}T23:59:59.999Z`);
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId,
      schoolYearId: query.schoolYearId
    };

    const [studentTotal, studentCreatedInWindow, schoolYears, classes, subjects, enrollments, invoices, overdueInvoices, paymentsInWindow, attendanceTotal, absenceCount, justifiedAbsenceCount, queuedNotifications, failedNotifications, mosqueMembers, mosqueActiveMembers, mosqueActivitiesInWindow, mosqueDonationsInWindow, paymentRows, donationRows, absenceRows] =
      await Promise.all([
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null
          }
        }),
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null,
            createdAt: {
              gte: periodStart,
              lte: periodEnd
            }
          }
        }),
        this.prisma.schoolYear.count({ where: { tenantId } }),
        this.prisma.classroom.count({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId
          }
        }),
        this.prisma.subject.count({ where: { tenantId } }),
        this.prisma.enrollment.count({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId,
            enrollmentStatus: "ENROLLED"
          }
        }),
        this.prisma.invoice.aggregate({
          where: invoiceWhere,
          _sum: {
            amountDue: true,
            amountPaid: true
          }
        }),
        this.prisma.invoice.count({
          where: {
            ...invoiceWhere,
            status: {
              in: ["OPEN", "PARTIAL"]
            },
            dueDate: {
              lt: new Date()
            }
          }
        }),
        this.prisma.payment.aggregate({
          where: {
            tenantId,
            paidAt: {
              gte: periodStart,
              lte: periodEnd
            },
            invoice: query.schoolYearId ? { schoolYearId: query.schoolYearId } : undefined
          },
          _sum: {
            paidAmount: true
          },
          _count: {
            _all: true
          }
        }),
        this.prisma.attendance.count({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId,
            attendanceDate: {
              gte: periodStart,
              lte: periodEnd
            }
          }
        }),
        this.prisma.attendance.count({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId,
            attendanceDate: {
              gte: periodStart,
              lte: periodEnd
            },
            status: {
              in: ["ABSENT", "LATE"]
            }
          }
        }),
        this.prisma.attendance.count({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId,
            attendanceDate: {
              gte: periodStart,
              lte: periodEnd
            },
            status: {
              in: ["ABSENT", "LATE"]
            },
            justificationStatus: {
              in: ["APPROVED", "VALIDATED"]
            }
          }
        }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [
              { status: { in: ["PENDING", "SCHEDULED"] } },
              { deliveryStatus: { in: ["QUEUED", "RETRYING", "SENT_TO_PROVIDER"] } }
            ]
          }
        }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [
              { status: "FAILED" },
              { deliveryStatus: { in: ["FAILED", "UNDELIVERABLE"] } }
            ]
          }
        }),
        this.prisma.mosqueMember.count({ where: { tenantId } }),
        this.prisma.mosqueMember.count({ where: { tenantId, status: "ACTIVE" } }),
        this.prisma.mosqueActivity.count({
          where: {
            tenantId,
            activityDate: {
              gte: periodStart,
              lte: periodEnd
            }
          }
        }),
        this.prisma.mosqueDonation.aggregate({
          where: {
            tenantId,
            donatedAt: {
              gte: periodStart,
              lte: periodEnd
            }
          },
          _sum: {
            amount: true
          },
          _count: {
            _all: true
          }
        }),
        this.prisma.payment.findMany({
          where: {
            tenantId,
            paidAt: {
              gte: periodStart,
              lte: periodEnd
            },
            invoice: query.schoolYearId ? { schoolYearId: query.schoolYearId } : undefined
          },
          select: {
            paidAt: true,
            paidAmount: true
          }
        }),
        this.prisma.mosqueDonation.findMany({
          where: {
            tenantId,
            donatedAt: {
              gte: periodStart,
              lte: periodEnd
            }
          },
          select: {
            donatedAt: true,
            amount: true
          }
        }),
        this.prisma.attendance.findMany({
          where: {
            tenantId,
            schoolYearId: query.schoolYearId,
            attendanceDate: {
              gte: periodStart,
              lte: periodEnd
            },
            status: {
              in: ["ABSENT", "LATE"]
            }
          },
          select: {
            attendanceDate: true
          }
        })
      ]);

    const amountDue = this.decimalToNumber(invoices._sum.amountDue);
    const amountPaid = this.decimalToNumber(invoices._sum.amountPaid);
    const remainingAmount = this.roundAmount(amountDue - amountPaid);
    const paymentsInWindowAmount = this.decimalToNumber(paymentsInWindow._sum.paidAmount);
    const donationsInWindow = this.decimalToNumber(mosqueDonationsInWindow._sum.amount);
    const monthBuckets = this.buildMonthBuckets(periodStart, periodEnd);
    const paymentsTrend = this.aggregateMonthlyAmount(
      monthBuckets,
      paymentRows.map((row) => ({
        date: row.paidAt,
        value: this.decimalToNumber(row.paidAmount)
      }))
    );
    const donationsTrend = this.aggregateMonthlyAmount(
      monthBuckets,
      donationRows.map((row) => ({
        date: row.donatedAt,
        value: this.decimalToNumber(row.amount)
      }))
    );
    const absencesTrend = this.aggregateMonthlyCount(
      monthBuckets,
      absenceRows.map((row) => row.attendanceDate)
    );

    const payload: AnalyticsOverviewView = {
      generatedAt: new Date().toISOString(),
      window: {
        from: range.from,
        to: range.to,
        days: range.days
      },
      students: {
        total: studentTotal,
        active: studentTotal,
        createdInWindow: studentCreatedInWindow
      },
      academics: {
        schoolYears,
        classes,
        subjects,
        activeEnrollments: enrollments
      },
      finance: {
        amountDue,
        amountPaid,
        remainingAmount,
        recoveryRatePercent: amountDue > 0 ? this.roundAmount((amountPaid / amountDue) * 100) : 0,
        paymentsInWindow: paymentsInWindowAmount,
        overdueInvoices
      },
      schoolLife: {
        attendanceEntries: attendanceTotal,
        absences: absenceCount,
        justifiedAbsences: justifiedAbsenceCount,
        justificationRatePercent:
          absenceCount > 0 ? this.roundAmount((justifiedAbsenceCount / absenceCount) * 100) : 0,
        notificationsQueued: queuedNotifications,
        notificationsFailed: failedNotifications
      },
      mosque: {
        members: mosqueMembers,
        activeMembers: mosqueActiveMembers,
        activitiesInWindow: mosqueActivitiesInWindow,
        donationsInWindow,
        donationsCountInWindow: mosqueDonationsInWindow._count._all
      },
      trends: {
        payments: paymentsTrend,
        donations: donationsTrend,
        absences: absencesTrend
      }
    };

    this.overviewCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + this.analyticsCacheTtlMs()
    });
    this.compactCache(this.overviewCache);
    return payload;
  }

  async listAuditLogs(tenantId: string, query: AuditLogQueryDto): Promise<AuditLogPageView> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = this.buildAuditWhere(tenantId, query);

    const [total, rows] = await Promise.all([
      this.prisma.iamAuditLog.count({ where }),
      this.prisma.iamAuditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
      items: rows.map((row) => this.toAuditLogView(row))
    };
  }

  async exportAuditLogs(
    tenantId: string,
    query: AuditLogExportQueryDto
  ): Promise<AuditLogExportView> {
    const format = (query.format || "PDF").toUpperCase() as "PDF" | "EXCEL";
    const take = Math.min(5000, Math.max(1, query.limit ?? 500));
    const where = this.buildAuditWhere(tenantId, query);
    const rows = await this.prisma.iamAuditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take
    });

    const headers = ["Date", "Utilisateur", "Action", "Ressource", "Resource ID", "Payload"];
    const exportRows = rows.map((row) => {
      const item = this.toAuditLogView(row);
      return [
        item.createdAt,
        item.username || "-",
        item.action,
        item.resource,
        item.resourceId || "-",
        item.payloadPreview || "-"
      ];
    });

    if (format === "EXCEL") {
      const buffer = buildExcelXml({
        title: "Audit Logs",
        generatedAtIso: new Date().toISOString(),
        headers,
        rows: exportRows
      });
      const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.xls`;
      return {
        format,
        fileName,
        mimeType: "application/vnd.ms-excel",
        dataUrl: toDataUrl("application/vnd.ms-excel", buffer),
        dataBase64: buffer.toString("base64"),
        generatedAt: new Date().toISOString(),
        rowCount: rows.length
      };
    }

    const buffer = buildTablePdf({
      title: "Audit Logs",
      generatedAtIso: new Date().toISOString(),
      headers,
      rows: exportRows
    });
    const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
    return {
      format: "PDF",
      fileName,
      mimeType: "application/pdf",
      dataUrl: toDataUrl("application/pdf", buffer),
      dataBase64: buffer.toString("base64"),
      generatedAt: new Date().toISOString(),
      rowCount: rows.length
    };
  }

  private buildAuditWhere(
    tenantId: string,
    query: Pick<AuditLogQueryDto, "resource" | "action" | "userId" | "q" | "from" | "to">
  ): Prisma.IamAuditLogWhereInput {
    const dateFilter = this.resolveDateFilter(query.from, query.to);
    const search = query.q?.trim();
    const where: Prisma.IamAuditLogWhereInput = {
      tenantId,
      resource: query.resource?.trim() || undefined,
      action: query.action?.trim() || undefined,
      userId: query.userId || undefined,
      createdAt: dateFilter
    };

    if (search) {
      where.OR = [
        {
          action: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          resource: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          resourceId: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          user: {
            is: {
              username: {
                contains: search,
                mode: "insensitive"
              }
            }
          }
        }
      ];
    }

    return where;
  }

  private toAuditLogView(row: AuditLogWithUser): AuditLogItemView {
    const payload = this.sanitizePayload(row.payload as unknown);
    const payloadPreview = payload === undefined ? undefined : this.payloadPreview(payload);

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId || undefined,
      userId: row.userId || undefined,
      username: row.user?.username || undefined,
      payload,
      payloadPreview
    };
  }

  private sanitizePayload(value: unknown): unknown {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizePayload(item));
    }

    if (typeof value === "object") {
      const source = value as Record<string, unknown>;
      const target: Record<string, unknown> = {};
      for (const [key, raw] of Object.entries(source)) {
        if (this.isSensitiveKey(key)) {
          target[key] = "***";
        } else {
          target[key] = this.sanitizePayload(raw);
        }
      }
      return target;
    }

    if (typeof value === "string" && value.length > 220) {
      return `${value.slice(0, 217)}...`;
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.trim().toLowerCase();
    return ["password", "pwd", "secret", "token", "hash", "authorization"].some((needle) =>
      normalized.includes(needle)
    );
  }

  private payloadPreview(payload: unknown): string {
    try {
      const raw = JSON.stringify(payload);
      if (!raw) {
        return "";
      }
      return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
    } catch {
      return "payload";
    }
  }

  private resolveRange(from?: string, to?: string): { from: string; to: string; days: number } {
    const today = new Date();
    const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const defaultFrom = new Date(defaultTo);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 89);

    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : defaultFrom;
    const toDate = to ? new Date(`${to}T00:00:00.000Z`) : defaultTo;

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return {
        from: defaultFrom.toISOString().slice(0, 10),
        to: defaultTo.toISOString().slice(0, 10),
        days: 90
      };
    }

    const safeFrom = fromDate <= toDate ? fromDate : toDate;
    const safeTo = fromDate <= toDate ? toDate : fromDate;
    const days = Math.max(
      1,
      Math.floor((safeTo.getTime() - safeFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );

    return {
      from: safeFrom.toISOString().slice(0, 10),
      to: safeTo.toISOString().slice(0, 10),
      days
    };
  }

  private resolveDateFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const range = this.resolveRange(from, to);
    if (!from && !to) {
      return undefined;
    }
    return {
      gte: new Date(`${range.from}T00:00:00.000Z`),
      lte: new Date(`${range.to}T23:59:59.999Z`)
    };
  }

  private buildMonthBuckets(from: Date, to: Date): Array<{ key: string; label: string }> {
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    const months: Array<{ key: string; label: string }> = [];

    while (cursor <= end) {
      const key = this.monthKey(cursor);
      const label = cursor.toLocaleString("fr-FR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
      months.push({ key, label });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return months;
  }

  private aggregateMonthlyAmount(
    buckets: Array<{ key: string; label: string }>,
    rows: Array<{ date: Date; value: number }>
  ): MonthlyPoint[] {
    const map = new Map<string, number>();
    for (const bucket of buckets) {
      map.set(bucket.key, 0);
    }

    for (const row of rows) {
      const key = this.monthKey(row.date);
      if (!map.has(key)) continue;
      map.set(key, this.roundAmount((map.get(key) || 0) + row.value));
    }

    return buckets.map((bucket) => ({
      bucket: bucket.key,
      label: bucket.label,
      value: this.roundAmount(map.get(bucket.key) || 0)
    }));
  }

  private aggregateMonthlyCount(
    buckets: Array<{ key: string; label: string }>,
    dates: Date[]
  ): MonthlyPoint[] {
    const map = new Map<string, number>();
    for (const bucket of buckets) {
      map.set(bucket.key, 0);
    }

    for (const date of dates) {
      const key = this.monthKey(date);
      if (!map.has(key)) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }

    return buckets.map((bucket) => ({
      bucket: bucket.key,
      label: bucket.label,
      value: map.get(bucket.key) || 0
    }));
  }

  private monthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private decimalToNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) return 0;
    if (typeof value === "number") return value;
    return Number(value.toString());
  }

  private roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private analyticsCacheTtlMs(): number {
    const raw = Number(this.configService.get<string>("ANALYTICS_CACHE_TTL_SECONDS", "45"));
    if (!Number.isFinite(raw) || raw <= 0) {
      return 45_000;
    }
    return raw * 1000;
  }

  private compactCache<K, V>(cache: Map<K, V>): void {
    if (cache.size <= 60) {
      return;
    }
    const firstKey = cache.keys().next().value as K | undefined;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
}
