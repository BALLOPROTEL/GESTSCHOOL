import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  type MosqueActivity,
  type MosqueDonation,
  type MosqueMember
} from "@prisma/client";

import { buildExcelXml, buildTablePdf, toDataUrl } from "../common/export.util";
import { buildSimplePdf, toPdfDataUrl } from "../common/pdf.util";
import { PrismaService } from "../database/prisma.service";
import {
  CreateMosqueActivityDto,
  CreateMosqueDonationDto,
  CreateMosqueMemberDto,
  UpdateMosqueActivityDto,
  UpdateMosqueDonationDto,
  UpdateMosqueMemberDto
} from "./dto/mosque.dto";

type MosqueMemberView = {
  id: string;
  tenantId: string;
  memberCode: string;
  fullName: string;
  sex?: string;
  phone?: string;
  email?: string;
  address?: string;
  joinedAt?: string;
  status: string;
};

type MosqueActivityView = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  activityDate: string;
  category: string;
  location?: string;
  description?: string;
  isSchoolLinked: boolean;
};

type MosqueDonationView = {
  id: string;
  tenantId: string;
  memberId?: string;
  memberCode?: string;
  memberName?: string;
  amount: number;
  currency: string;
  channel: string;
  donatedAt: string;
  referenceNo?: string;
  notes?: string;
};

type MosqueDashboardView = {
  totals: {
    members: number;
    activeMembers: number;
    activitiesThisMonth: number;
    donationsThisMonth: number;
    donationsTotal: number;
    averageDonation: number;
  };
  donationsByChannel: Array<{
    channel: string;
    count: number;
    totalAmount: number;
  }>;
};

type ExportFormat = "PDF" | "EXCEL";

type ExportFileView = {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

type DonationReceiptView = MosqueDonationView & {
  receiptNo: string;
  pdfDataUrl: string;
};

@Injectable()
export class MosqueService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(
    tenantId: string,
    filters: { status?: string; q?: string }
  ): Promise<MosqueMemberView[]> {
    const query = filters.q?.trim();
    const rows = await this.prisma.mosqueMember.findMany({
      where: {
        tenantId,
        status: filters.status?.trim().toUpperCase(),
        OR: query
          ? [
              { memberCode: { contains: query, mode: "insensitive" } },
              { fullName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ fullName: "asc" }]
    });
    return rows.map((row) => this.memberView(row));
  }

  async createMember(
    tenantId: string,
    payload: CreateMosqueMemberDto
  ): Promise<MosqueMemberView> {
    try {
      const created = await this.prisma.mosqueMember.create({
        data: {
          tenantId,
          memberCode: payload.memberCode.trim().toUpperCase(),
          fullName: payload.fullName.trim(),
          sex: payload.sex?.trim().toUpperCase(),
          phone: this.cleanOptional(payload.phone),
          email: this.cleanOptional(payload.email),
          address: this.cleanOptional(payload.address),
          joinedAt: payload.joinedAt ? new Date(payload.joinedAt) : null,
          status: payload.status?.trim().toUpperCase() || "ACTIVE",
          updatedAt: new Date()
        }
      });
      return this.memberView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Member code already exists.");
      throw error;
    }
  }

  async updateMember(
    tenantId: string,
    id: string,
    payload: UpdateMosqueMemberDto
  ): Promise<MosqueMemberView> {
    await this.requireMember(tenantId, id);
    try {
      const updated = await this.prisma.mosqueMember.update({
        where: { id },
        data: {
          memberCode: payload.memberCode?.trim().toUpperCase(),
          fullName: payload.fullName?.trim(),
          sex: payload.sex?.trim().toUpperCase(),
          phone: payload.phone === undefined ? undefined : this.cleanOptional(payload.phone),
          email: payload.email === undefined ? undefined : this.cleanOptional(payload.email),
          address:
            payload.address === undefined ? undefined : this.cleanOptional(payload.address),
          joinedAt:
            payload.joinedAt === undefined
              ? undefined
              : payload.joinedAt
                ? new Date(payload.joinedAt)
                : null,
          status: payload.status?.trim().toUpperCase(),
          updatedAt: new Date()
        }
      });
      return this.memberView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Member code already exists.");
      throw error;
    }
  }

  async deleteMember(tenantId: string, id: string): Promise<void> {
    await this.requireMember(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.mosqueMember.delete({ where: { id } }),
      "Member cannot be deleted."
    );
  }

  async listActivities(
    tenantId: string,
    filters: { category?: string; from?: string; to?: string; q?: string }
  ): Promise<MosqueActivityView[]> {
    const query = filters.q?.trim();
    const rows = await this.prisma.mosqueActivity.findMany({
      where: {
        tenantId,
        category: filters.category?.trim().toUpperCase(),
        activityDate:
          filters.from || filters.to
            ? {
                gte: filters.from ? new Date(filters.from) : undefined,
                lte: filters.to ? new Date(filters.to) : undefined
              }
            : undefined,
        OR: query
          ? [
              { code: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { location: { contains: query, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ activityDate: "desc" }, { code: "asc" }]
    });
    return rows.map((row) => this.activityView(row));
  }

  async createActivity(
    tenantId: string,
    payload: CreateMosqueActivityDto
  ): Promise<MosqueActivityView> {
    try {
      const created = await this.prisma.mosqueActivity.create({
        data: {
          tenantId,
          code: payload.code.trim().toUpperCase(),
          title: payload.title.trim(),
          activityDate: new Date(payload.activityDate),
          category: payload.category.trim().toUpperCase(),
          location: this.cleanOptional(payload.location),
          description: this.cleanOptional(payload.description),
          isSchoolLinked: payload.isSchoolLinked ?? false,
          updatedAt: new Date()
        }
      });
      return this.activityView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Activity code already exists.");
      throw error;
    }
  }

  async updateActivity(
    tenantId: string,
    id: string,
    payload: UpdateMosqueActivityDto
  ): Promise<MosqueActivityView> {
    await this.requireActivity(tenantId, id);
    try {
      const updated = await this.prisma.mosqueActivity.update({
        where: { id },
        data: {
          code: payload.code?.trim().toUpperCase(),
          title: payload.title?.trim(),
          activityDate: payload.activityDate ? new Date(payload.activityDate) : undefined,
          category: payload.category?.trim().toUpperCase(),
          location:
            payload.location === undefined ? undefined : this.cleanOptional(payload.location),
          description:
            payload.description === undefined
              ? undefined
              : this.cleanOptional(payload.description),
          isSchoolLinked: payload.isSchoolLinked,
          updatedAt: new Date()
        }
      });
      return this.activityView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Activity code already exists.");
      throw error;
    }
  }

  async deleteActivity(tenantId: string, id: string): Promise<void> {
    await this.requireActivity(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.mosqueActivity.delete({ where: { id } }),
      "Activity cannot be deleted."
    );
  }

  async listDonations(
    tenantId: string,
    filters: { memberId?: string; channel?: string; from?: string; to?: string }
  ): Promise<MosqueDonationView[]> {
    const rows = await this.prisma.mosqueDonation.findMany({
      where: {
        tenantId,
        memberId: filters.memberId,
        channel: filters.channel?.trim().toUpperCase(),
        donatedAt:
          filters.from || filters.to
            ? {
                gte: filters.from ? new Date(filters.from) : undefined,
                lte: filters.to ? new Date(filters.to) : undefined
              }
            : undefined
      },
      include: {
        member: true
      },
      orderBy: [{ donatedAt: "desc" }]
    });
    return rows.map((row) => this.donationView(row));
  }

  async createDonation(
    tenantId: string,
    payload: CreateMosqueDonationDto
  ): Promise<MosqueDonationView> {
    if (payload.memberId) {
      await this.requireMember(tenantId, payload.memberId);
    }
    try {
      const created = await this.prisma.mosqueDonation.create({
        data: {
          tenantId,
          memberId: payload.memberId,
          amount: payload.amount,
          currency: (payload.currency || "XOF").trim().toUpperCase(),
          channel: (payload.channel || "CASH").trim().toUpperCase(),
          donatedAt: payload.donatedAt ? new Date(payload.donatedAt) : new Date(),
          referenceNo: this.cleanOptional(payload.referenceNo),
          notes: this.cleanOptional(payload.notes),
          updatedAt: new Date()
        },
        include: {
          member: true
        }
      });
      return this.donationView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Donation reference already exists.");
      throw error;
    }
  }

  async updateDonation(
    tenantId: string,
    id: string,
    payload: UpdateMosqueDonationDto
  ): Promise<MosqueDonationView> {
    await this.requireDonation(tenantId, id);
    if (payload.memberId) {
      await this.requireMember(tenantId, payload.memberId);
    }
    try {
      const updated = await this.prisma.mosqueDonation.update({
        where: { id },
        data: {
          memberId: payload.memberId,
          amount: payload.amount,
          currency: payload.currency?.trim().toUpperCase(),
          channel: payload.channel?.trim().toUpperCase(),
          donatedAt: payload.donatedAt ? new Date(payload.donatedAt) : undefined,
          referenceNo:
            payload.referenceNo === undefined
              ? undefined
              : this.cleanOptional(payload.referenceNo),
          notes: payload.notes === undefined ? undefined : this.cleanOptional(payload.notes),
          updatedAt: new Date()
        },
        include: {
          member: true
        }
      });
      return this.donationView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Donation reference already exists.");
      throw error;
    }
  }

  async deleteDonation(tenantId: string, id: string): Promise<void> {
    await this.requireDonation(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.mosqueDonation.delete({ where: { id } }),
      "Donation cannot be deleted."
    );
  }

  async dashboard(tenantId: string): Promise<MosqueDashboardView> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    const [members, activeMembers, activitiesThisMonth, donationsAgg, donationsMonthAgg, byChannel] =
      await Promise.all([
        this.prisma.mosqueMember.count({
          where: { tenantId }
        }),
        this.prisma.mosqueMember.count({
          where: { tenantId, status: "ACTIVE" }
        }),
        this.prisma.mosqueActivity.count({
          where: {
            tenantId,
            activityDate: {
              gte: monthStart,
              lt: nextMonthStart
            }
          }
        }),
        this.prisma.mosqueDonation.aggregate({
          where: {
            tenantId
          },
          _sum: {
            amount: true
          },
          _count: {
            _all: true
          }
        }),
        this.prisma.mosqueDonation.aggregate({
          where: {
            tenantId,
            donatedAt: {
              gte: monthStart,
              lt: nextMonthStart
            }
          },
          _sum: {
            amount: true
          }
        }),
        this.prisma.mosqueDonation.groupBy({
          by: ["channel"],
          where: {
            tenantId
          },
          _count: {
            channel: true
          },
          _sum: {
            amount: true
          }
        })
      ]);

    const donationsTotal = this.decimalToNumber(donationsAgg._sum.amount);
    const donationsCount = donationsAgg._count._all;
    const donationsThisMonth = this.decimalToNumber(donationsMonthAgg._sum.amount);

    return {
      totals: {
        members,
        activeMembers,
        activitiesThisMonth,
        donationsThisMonth,
        donationsTotal,
        averageDonation:
          donationsCount > 0
            ? this.roundAmount(donationsTotal / donationsCount)
            : 0
      },
      donationsByChannel: byChannel
        .map((item) => ({
          channel: item.channel,
          count: item._count.channel,
          totalAmount: this.decimalToNumber(item._sum.amount)
        }))
        .sort((left, right) => right.totalAmount - left.totalAmount)
    };
  }

  async exportMembers(
    tenantId: string,
    filters: { status?: string; q?: string },
    format: ExportFormat
  ): Promise<ExportFileView> {
    const rows = await this.listMembers(tenantId, filters);
    return this.buildExportFile({
      format,
      filePrefix: "mosque-members",
      title: "GestSchool Mosque Members",
      headers: [
        "Member Code",
        "Full Name",
        "Status",
        "Sex",
        "Phone",
        "Email",
        "Joined At"
      ],
      rows: rows.map((row) => [
        row.memberCode,
        row.fullName,
        row.status,
        row.sex || "",
        row.phone || "",
        row.email || "",
        row.joinedAt || ""
      ])
    });
  }

  async exportActivities(
    tenantId: string,
    filters: { category?: string; from?: string; to?: string; q?: string },
    format: ExportFormat
  ): Promise<ExportFileView> {
    const rows = await this.listActivities(tenantId, filters);
    return this.buildExportFile({
      format,
      filePrefix: "mosque-activities",
      title: "GestSchool Mosque Activities",
      headers: [
        "Code",
        "Title",
        "Date",
        "Category",
        "Location",
        "School Linked"
      ],
      rows: rows.map((row) => [
        row.code,
        row.title,
        row.activityDate,
        row.category,
        row.location || "",
        row.isSchoolLinked ? "YES" : "NO"
      ])
    });
  }

  async exportDonations(
    tenantId: string,
    filters: { memberId?: string; channel?: string; from?: string; to?: string },
    format: ExportFormat
  ): Promise<ExportFileView> {
    const rows = await this.listDonations(tenantId, filters);
    return this.buildExportFile({
      format,
      filePrefix: "mosque-donations",
      title: "GestSchool Mosque Donations",
      headers: [
        "Date",
        "Member",
        "Member Code",
        "Amount",
        "Currency",
        "Channel",
        "Reference",
        "Notes"
      ],
      rows: rows.map((row) => [
        row.donatedAt,
        row.memberName || "",
        row.memberCode || "",
        row.amount,
        row.currency,
        row.channel,
        row.referenceNo || "",
        row.notes || ""
      ])
    });
  }

  async getDonationReceipt(
    tenantId: string,
    donationId: string
  ): Promise<DonationReceiptView> {
    const donation = await this.prisma.mosqueDonation.findFirst({
      where: {
        id: donationId,
        tenantId
      },
      include: {
        member: true
      }
    });

    if (!donation) {
      throw new NotFoundException("Mosque donation not found.");
    }

    const view = this.donationView(donation);
    const receiptNo = donation.referenceNo || `DON-${donation.id.slice(0, 8).toUpperCase()}`;

    const pdf = buildSimplePdf([
      "GestSchool Mosque Donation Receipt",
      `Receipt: ${receiptNo}`,
      `Donor: ${view.memberName || "Anonymous"}`,
      `Member Code: ${view.memberCode || "-"}`,
      `Amount: ${view.amount.toFixed(2)} ${view.currency}`,
      `Channel: ${view.channel}`,
      `Donated At: ${view.donatedAt}`,
      `Reference: ${view.referenceNo || "-"}`,
      `Notes: ${view.notes || "-"}`
    ]);

    return {
      ...view,
      receiptNo,
      pdfDataUrl: toPdfDataUrl(pdf)
    };
  }

  private memberView(row: MosqueMember): MosqueMemberView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      memberCode: row.memberCode,
      fullName: row.fullName,
      sex: row.sex || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      joinedAt: row.joinedAt?.toISOString().slice(0, 10),
      status: row.status
    };
  }

  private activityView(row: MosqueActivity): MosqueActivityView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      title: row.title,
      activityDate: row.activityDate.toISOString().slice(0, 10),
      category: row.category,
      location: row.location || undefined,
      description: row.description || undefined,
      isSchoolLinked: row.isSchoolLinked
    };
  }

  private donationView(
    row: MosqueDonation & {
      member?: MosqueMember | null;
    }
  ): MosqueDonationView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      memberId: row.memberId || undefined,
      memberCode: row.member?.memberCode,
      memberName: row.member?.fullName,
      amount: this.decimalToNumber(row.amount),
      currency: row.currency,
      channel: row.channel,
      donatedAt: row.donatedAt.toISOString(),
      referenceNo: row.referenceNo || undefined,
      notes: row.notes || undefined
    };
  }

  private async requireMember(tenantId: string, id: string): Promise<MosqueMember> {
    const row = await this.prisma.mosqueMember.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Mosque member not found.");
    }
    return row;
  }

  private async requireActivity(
    tenantId: string,
    id: string
  ): Promise<MosqueActivity> {
    const row = await this.prisma.mosqueActivity.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Mosque activity not found.");
    }
    return row;
  }

  private async requireDonation(
    tenantId: string,
    id: string
  ): Promise<MosqueDonation> {
    const row = await this.prisma.mosqueDonation.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Mosque donation not found.");
    }
    return row;
  }

  private cleanOptional(value: string | undefined): string | null {
    if (value === undefined) return null;
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private decimalToNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }
    if (typeof value === "number") {
      return value;
    }
    return Number(value.toString());
  }

  private roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
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

  private buildExportFile(payload: {
    format: ExportFormat;
    filePrefix: string;
    title: string;
    headers: string[];
    rows: Array<Array<string | number | boolean | null | undefined>>;
  }): ExportFileView {
    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.slice(0, 19).replace(/[:T]/g, "-");

    if (payload.format === "PDF") {
      const pdf = buildTablePdf({
        title: payload.title,
        generatedAtIso: generatedAt,
        headers: payload.headers,
        rows: payload.rows
      });
      return {
        format: "PDF",
        fileName: `${payload.filePrefix}-${stamp}.pdf`,
        mimeType: "application/pdf",
        dataUrl: toDataUrl("application/pdf", pdf),
        dataBase64: pdf.toString("base64"),
        generatedAt,
        rowCount: payload.rows.length
      };
    }

    const excel = buildExcelXml({
      title: payload.title,
      generatedAtIso: generatedAt,
      headers: payload.headers,
      rows: payload.rows
    });

    return {
      format: "EXCEL",
      fileName: `${payload.filePrefix}-${stamp}.xls`,
      mimeType: "application/vnd.ms-excel",
      dataUrl: toDataUrl("application/vnd.ms-excel", excel),
      dataBase64: excel.toString("base64"),
      generatedAt,
      rowCount: payload.rows.length
    };
  }
}
