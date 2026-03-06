import { randomUUID } from "node:crypto";

import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type FeePlan, type Invoice, type Payment, type Student } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  CreateFeePlanDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  UpdateFeePlanDto,
  UpdateInvoiceDto
} from "./dto/finance.dto";
import { buildSimplePdf, toPdfDataUrl } from "../common/pdf.util";

type FeePlanView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

type InvoiceView = {
  id: string;
  tenantId: string;
  studentId: string;
  schoolYearId: string;
  feePlanId?: string;
  invoiceNo: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  status: string;
  dueDate?: string;
  studentName?: string;
  schoolYearCode?: string;
  feePlanLabel?: string;
};

type PaymentView = {
  id: string;
  tenantId: string;
  invoiceId: string;
  invoiceNo?: string;
  studentId?: string;
  studentName?: string;
  schoolYearId?: string;
  receiptNo: string;
  paidAmount: number;
  paymentMethod: string;
  paidAt: string;
  referenceExternal?: string;
};

type ReceiptView = PaymentView & {
  pdfDataUrl: string;
};

type RecoveryDashboardView = {
  schoolYearId?: string;
  totals: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
  };
  invoices: {
    total: number;
    open: number;
    partial: number;
    paid: number;
    void: number;
  };
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService
  ) {}

  async listFeePlans(
    tenantId: string,
    filters: { schoolYearId?: string; levelId?: string }
  ): Promise<FeePlanView[]> {
    const rows = await this.prisma.feePlan.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        levelId: filters.levelId
      },
      orderBy: [{ label: "asc" }]
    });

    return rows.map((row) => this.feePlanView(row));
  }

  async createFeePlan(
    tenantId: string,
    payload: CreateFeePlanDto
  ): Promise<FeePlanView> {
    await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);
    await this.referenceService.requireLevel(tenantId, payload.levelId);

    try {
      const created = await this.prisma.feePlan.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          label: payload.label.trim(),
          totalAmount: payload.totalAmount,
          currency: (payload.currency || "CFA").trim().toUpperCase(),
          updatedAt: new Date()
        }
      });

      return this.feePlanView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Fee plan already exists for this level and school year.");
      throw error;
    }
  }

  async updateFeePlan(
    tenantId: string,
    id: string,
    payload: UpdateFeePlanDto
  ): Promise<FeePlanView> {
    await this.requireFeePlan(tenantId, id);
    if (payload.schoolYearId) {
      await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    if (payload.levelId) {
      await this.referenceService.requireLevel(tenantId, payload.levelId);
    }

    try {
      const updated = await this.prisma.feePlan.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          label: payload.label?.trim(),
          totalAmount: payload.totalAmount,
          currency: payload.currency?.trim().toUpperCase(),
          updatedAt: new Date()
        }
      });

      return this.feePlanView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Fee plan already exists for this level and school year.");
      throw error;
    }
  }

  async deleteFeePlan(tenantId: string, id: string): Promise<void> {
    await this.requireFeePlan(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.feePlan.delete({ where: { id } }),
      "Fee plan cannot be deleted because invoices are linked to it."
    );
  }

  async listInvoices(
    tenantId: string,
    filters: { schoolYearId?: string; studentId?: string; status?: string }
  ): Promise<InvoiceView[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        studentId: filters.studentId,
        status: filters.status
      },
      include: {
        student: true,
        schoolYear: true,
        feePlan: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.invoiceView(row));
  }

  async createInvoice(
    tenantId: string,
    payload: CreateInvoiceDto
  ): Promise<InvoiceView> {
    const student = await this.requireStudent(tenantId, payload.studentId);
    await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);

    let amountDue = payload.amountDue;
    let feePlanLabel: string | undefined;

    if (payload.feePlanId) {
      const feePlan = await this.requireFeePlan(tenantId, payload.feePlanId);
      amountDue = payload.amountDue ?? this.decimalToNumber(feePlan.totalAmount);
      feePlanLabel = feePlan.label;

      if (feePlan.schoolYearId !== payload.schoolYearId) {
        throw new ConflictException("Fee plan school year must match invoice school year.");
      }
    }

    if (amountDue === undefined) {
      throw new ConflictException("amountDue is required when feePlanId is not provided.");
    }

    if (amountDue < 0) {
      throw new ConflictException("amountDue must be greater than or equal to 0.");
    }

    const invoiceNo = payload.invoiceNo?.trim() || this.generateInvoiceNo();

    try {
      const created = await this.prisma.invoice.create({
        data: {
          tenantId,
          studentId: student.id,
          schoolYearId: payload.schoolYearId,
          feePlanId: payload.feePlanId,
          invoiceNo,
          amountDue,
          amountPaid: 0,
          status: amountDue === 0 ? "PAID" : "OPEN",
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          updatedAt: new Date()
        },
        include: {
          student: true,
          schoolYear: true,
          feePlan: true
        }
      });

      const view = this.invoiceView(created);
      view.feePlanLabel = view.feePlanLabel || feePlanLabel;
      return view;
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Invoice number already exists.");
      throw error;
    }
  }

  async updateInvoice(
    tenantId: string,
    id: string,
    payload: UpdateInvoiceDto
  ): Promise<InvoiceView> {
    const invoice = await this.requireInvoice(tenantId, id);

    const nextAmountDue = payload.amountDue ?? this.decimalToNumber(invoice.amountDue);
    const currentPaid = this.decimalToNumber(invoice.amountPaid);

    if (nextAmountDue < currentPaid) {
      throw new ConflictException("amountDue cannot be lower than amountPaid.");
    }

    const nextStatus = payload.status || this.resolveInvoiceStatus(currentPaid, nextAmountDue);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        amountDue: payload.amountDue,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : payload.dueDate === undefined ? undefined : null,
        status: nextStatus,
        updatedAt: new Date()
      },
      include: {
        student: true,
        schoolYear: true,
        feePlan: true
      }
    });

    return this.invoiceView(updated);
  }

  async deleteInvoice(tenantId: string, id: string): Promise<void> {
    await this.requireInvoice(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.invoice.delete({ where: { id } }),
      "Invoice cannot be deleted because payments are linked to it."
    );
  }

  async listPayments(
    tenantId: string,
    filters: { invoiceId?: string; schoolYearId?: string; studentId?: string }
  ): Promise<PaymentView[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId,
        invoiceId: filters.invoiceId,
        invoice: {
          schoolYearId: filters.schoolYearId,
          studentId: filters.studentId
        }
      },
      include: {
        invoice: {
          include: {
            student: true
          }
        }
      },
      orderBy: [{ paidAt: "desc" }]
    });

    return rows.map((row) => this.paymentView(row));
  }

  async recordPayment(
    tenantId: string,
    payload: CreatePaymentDto
  ): Promise<PaymentView> {
    const invoice = await this.requireInvoice(tenantId, payload.invoiceId);

    if (invoice.status === "VOID") {
      throw new ConflictException("Cannot register payment on a VOID invoice.");
    }

    const amountDue = this.decimalToNumber(invoice.amountDue);
    const amountPaid = this.decimalToNumber(invoice.amountPaid);
    const remainingAmount = this.roundAmount(amountDue - amountPaid);
    const paidAmount = this.roundAmount(payload.paidAmount);

    if (paidAmount <= 0) {
      throw new ConflictException("paidAmount must be greater than 0.");
    }

    if (paidAmount > remainingAmount + 0.0001) {
      throw new ConflictException("Paid amount exceeds invoice remaining amount.");
    }

    const receiptNo = this.generateReceiptNo();
    const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();

    const created = await this.prisma.$transaction(async (transaction) => {
      const createdPayment = await transaction.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          receiptNo,
          paidAmount,
          paymentMethod: payload.paymentMethod,
          paidAt,
          referenceExternal: payload.referenceExternal?.trim(),
          updatedAt: new Date()
        },
        include: {
          invoice: {
            include: {
              student: true
            }
          }
        }
      });

      const nextAmountPaid = this.roundAmount(amountPaid + paidAmount);
      const nextStatus = this.resolveInvoiceStatus(nextAmountPaid, amountDue);

      await transaction.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: nextAmountPaid,
          status: nextStatus,
          updatedAt: new Date()
        }
      });

      return createdPayment;
    });

    return this.paymentView(created);
  }

  async getReceipt(tenantId: string, paymentId: string): Promise<ReceiptView> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId
      },
      include: {
        invoice: {
          include: {
            student: true,
            schoolYear: true
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    const view = this.paymentView(payment);
    const invoice = payment.invoice;
    const remaining = this.roundAmount(
      this.decimalToNumber(invoice.amountDue) - this.decimalToNumber(invoice.amountPaid)
    );

    const pdf = buildSimplePdf([
      "GestSchool Receipt",
      `Receipt: ${payment.receiptNo}`,
      `Invoice: ${invoice.invoiceNo}`,
      `Student: ${invoice.student.firstName} ${invoice.student.lastName}`,
      `Method: ${payment.paymentMethod}`,
      `Paid Amount: ${view.paidAmount.toFixed(2)}`,
      `Remaining Amount: ${remaining.toFixed(2)}`,
      `Paid At: ${view.paidAt}`
    ]);

    return {
      ...view,
      pdfDataUrl: toPdfDataUrl(pdf)
    };
  }

  async recoveryDashboard(
    tenantId: string,
    schoolYearId?: string
  ): Promise<RecoveryDashboardView> {
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      schoolYearId
    };

    const [aggregate, grouped] = await Promise.all([
      this.prisma.invoice.aggregate({
        where,
        _sum: {
          amountDue: true,
          amountPaid: true
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.invoice.groupBy({
        by: ["status"],
        where,
        _count: {
          status: true
        }
      })
    ]);

    const amountDue = this.decimalToNumber(aggregate._sum.amountDue);
    const amountPaid = this.decimalToNumber(aggregate._sum.amountPaid);
    const remainingAmount = this.roundAmount(amountDue - amountPaid);

    const counts = {
      OPEN: 0,
      PARTIAL: 0,
      PAID: 0,
      VOID: 0
    };

    for (const entry of grouped) {
      if (entry.status in counts) {
        counts[entry.status as keyof typeof counts] = entry._count.status;
      }
    }

    return {
      schoolYearId,
      totals: {
        amountDue,
        amountPaid,
        remainingAmount,
        recoveryRatePercent: amountDue > 0 ? this.roundAmount((amountPaid / amountDue) * 100) : 0
      },
      invoices: {
        total: aggregate._count._all,
        open: counts.OPEN,
        partial: counts.PARTIAL,
        paid: counts.PAID,
        void: counts.VOID
      }
    };
  }

  private feePlanView(row: FeePlan): FeePlanView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      levelId: row.levelId,
      label: row.label,
      totalAmount: this.decimalToNumber(row.totalAmount),
      currency: row.currency
    };
  }

  private invoiceView(
    row: Invoice & {
      student?: { firstName: string; lastName: string } | null;
      schoolYear?: { code: string } | null;
      feePlan?: { label: string } | null;
    }
  ): InvoiceView {
    const amountDue = this.decimalToNumber(row.amountDue);
    const amountPaid = this.decimalToNumber(row.amountPaid);

    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      schoolYearId: row.schoolYearId,
      feePlanId: row.feePlanId === null ? undefined : row.feePlanId,
      invoiceNo: row.invoiceNo,
      amountDue,
      amountPaid,
      remainingAmount: this.roundAmount(amountDue - amountPaid),
      status: row.status,
      dueDate: row.dueDate?.toISOString().slice(0, 10),
      studentName: row.student ? `${row.student.firstName} ${row.student.lastName}`.trim() : undefined,
      schoolYearCode: row.schoolYear?.code,
      feePlanLabel: row.feePlan?.label
    };
  }

  private paymentView(
    row: Payment & {
      invoice?: {
        invoiceNo: string;
        schoolYearId: string;
        studentId: string;
        student?: { firstName: string; lastName: string } | null;
      } | null;
    }
  ): PaymentView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      invoiceId: row.invoiceId,
      invoiceNo: row.invoice?.invoiceNo,
      schoolYearId: row.invoice?.schoolYearId,
      studentId: row.invoice?.studentId,
      studentName: row.invoice?.student
        ? `${row.invoice.student.firstName} ${row.invoice.student.lastName}`.trim()
        : undefined,
      receiptNo: row.receiptNo,
      paidAmount: this.decimalToNumber(row.paidAmount),
      paymentMethod: row.paymentMethod,
      paidAt: row.paidAt.toISOString(),
      referenceExternal: row.referenceExternal || undefined
    };
  }

  private async requireFeePlan(tenantId: string, id: string): Promise<FeePlan> {
    const row = await this.prisma.feePlan.findFirst({
      where: { id, tenantId }
    });

    if (!row) {
      throw new NotFoundException("Fee plan not found.");
    }

    return row;
  }

  private async requireInvoice(tenantId: string, id: string): Promise<Invoice> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, tenantId }
    });

    if (!row) {
      throw new NotFoundException("Invoice not found.");
    }

    return row;
  }

  private async requireStudent(tenantId: string, id: string): Promise<Student> {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("Student not found.");
    }

    return row;
  }

  private resolveInvoiceStatus(amountPaid: number, amountDue: number): "OPEN" | "PARTIAL" | "PAID" {
    if (amountDue <= 0 || amountPaid >= amountDue) {
      return "PAID";
    }

    if (amountPaid <= 0) {
      return "OPEN";
    }

    return "PARTIAL";
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

  private generateInvoiceNo(): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `INV-${timestamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateReceiptNo(): string {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    return `RCP-${timestamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
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
}
