import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { hash } from "bcryptjs";
import * as request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma.service";
import { UserRole } from "../src/security/roles.enum";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

describe("Auth + Core Flows (e2e, real PostgreSQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let studentOneId: string;
  let studentTwoId: string;

  let schoolYearId: string;
  let cycleId: string;
  let levelId: string;
  let classId: string;
  let subjectId: string;
  let academicPeriodId: string;

  let enrollmentOneId: string;
  let enrollmentTwoId: string;

  let feePlanId: string;
  let invoiceId: string;
  let paymentId: string;

  let reportCardId: string;
  let attendanceId: string;
  let attendanceAttachmentId: string;
  let timetableSlotId: string;
  let notificationId: string;
  let managedUserId: string;
  let teacherAssignmentId: string;
  let parentLinkId: string;
  let mosqueMemberId: string;
  let mosqueActivityId: string;
  let mosqueDonationId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for e2e tests.");
    }

    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
    process.env.REFRESH_TOKEN_TTL_DAYS = process.env.REFRESH_TOKEN_TTL_DAYS || "30";
    process.env.DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || TENANT_ID;
    process.env.NOTIFICATIONS_WORKER_ENABLED = "false";
    process.env.NOTIFY_EMAIL_PROVIDER = "MOCK";
    process.env.NOTIFY_SMS_PROVIDER = "MOCK";
    process.env.NOTIFICATION_WEBHOOK_SECRET = "test-webhook-secret";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    prisma = app.get(PrismaService);
    await cleanDatabase();
    await seedUsers();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it("POST /auth/login should return access and refresh tokens", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "admin@gestschool.local",
        password: "admin12345",
        tenantId: TENANT_ID
      })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.user.role).toBe("ADMIN");
  });

  it("GET /students should reject missing token", async () => {
    await request(app.getHttpServer()).get("/api/v1/students").expect(401);
  });

  it("GET /students should reject role not authorized", async () => {
    const parentTokens = await login("parent@gestschool.local", "parent1234");

    await request(app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);
  });

  it("GET /students should reject tenant header override", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    await request(app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .set("x-tenant-id", "00000000-0000-0000-0000-000000000999")
      .expect(403);
  });

  it("POST /students should create two students", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const first = await request(app.getHttpServer())
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        matricule: "MAT-26-001",
        firstName: "Jean",
        lastName: "Kouassi",
        sex: "M",
        birthDate: "2014-10-02"
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        matricule: "MAT-26-002",
        firstName: "Marie",
        lastName: "Kone",
        sex: "F",
        birthDate: "2014-03-14"
      })
      .expect(201);

    studentOneId = first.body.id;
    studentTwoId = second.body.id;

    expect(studentOneId).toBeDefined();
    expect(studentTwoId).toBeDefined();
  });

  it("POST /school-years, /cycles, /levels, /classes, /subjects, /academic-periods should create reference", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const schoolYear = await request(app.getHttpServer())
      .post("/api/v1/school-years")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "2026-2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        isActive: true
      })
      .expect(201);
    schoolYearId = schoolYear.body.id;

    const cycle = await request(app.getHttpServer())
      .post("/api/v1/cycles")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "PRIMARY",
        label: "Primary",
        sortOrder: 1
      })
      .expect(201);
    cycleId = cycle.body.id;

    const level = await request(app.getHttpServer())
      .post("/api/v1/levels")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        cycleId,
        code: "CP1",
        label: "CP1",
        sortOrder: 1
      })
      .expect(201);
    levelId = level.body.id;

    const classroom = await request(app.getHttpServer())
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        schoolYearId,
        levelId,
        code: "CP1-A",
        label: "CP1 A",
        capacity: 30
      })
      .expect(201);
    classId = classroom.body.id;

    const subject = await request(app.getHttpServer())
      .post("/api/v1/subjects")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "MATH",
        label: "Mathematiques",
        isArabic: false
      })
      .expect(201);
    subjectId = subject.body.id;

    const period = await request(app.getHttpServer())
      .post("/api/v1/academic-periods")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        schoolYearId,
        code: "T1",
        label: "Trimestre 1",
        startDate: "2026-09-01",
        endDate: "2026-12-20",
        periodType: "TRIMESTER"
      })
      .expect(201);
    academicPeriodId = period.body.id;

    expect(subjectId).toBeDefined();
  });

  it("POST /enrollments should link two students to class and school year", async () => {
    const scolariteTokens = await login("scolarite@gestschool.local", "scolarite123");

    const first = await request(app.getHttpServer())
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        classId,
        schoolYearId,
        enrollmentDate: "2026-09-05"
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: studentTwoId,
        classId,
        schoolYearId,
        enrollmentDate: "2026-09-06"
      })
      .expect(201);

    enrollmentOneId = first.body.id;
    enrollmentTwoId = second.body.id;

    const listed = await request(app.getHttpServer())
      .get("/api/v1/enrollments")
      .query({ classId, schoolYearId })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(listed.body).toHaveLength(2);
  });

  it("POST /fee-plans and /invoices should create accounting records", async () => {
    const comptableTokens = await login("comptable@gestschool.local", "comptable123");

    const feePlan = await request(app.getHttpServer())
      .post("/api/v1/fee-plans")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        schoolYearId,
        levelId,
        label: "Frais CP1",
        totalAmount: 300000,
        currency: "XOF"
      })
      .expect(201);

    feePlanId = feePlan.body.id;

    const invoice = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        schoolYearId,
        feePlanId,
        dueDate: "2026-10-31"
      })
      .expect(201);

    invoiceId = invoice.body.id;
    expect(invoice.body.amountDue).toBe(300000);
    expect(invoice.body.status).toBe("OPEN");
  });

  it("POST /payments should record payment and update invoice", async () => {
    const comptableTokens = await login("comptable@gestschool.local", "comptable123");

    const payment = await request(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        invoiceId,
        paidAmount: 120000,
        paymentMethod: "CASH"
      })
      .expect(201);

    paymentId = payment.body.id;
    expect(payment.body.receiptNo).toContain("RCP-");

    const invoices = await request(app.getHttpServer())
      .get("/api/v1/invoices")
      .query({ studentId: studentOneId, schoolYearId })
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .expect(200);

    expect(invoices.body).toHaveLength(1);
    expect(invoices.body[0].amountPaid).toBe(120000);
    expect(invoices.body[0].status).toBe("PARTIAL");
  });

  it("GET /payments/:id/receipt and /finance/recovery should return receipt + dashboard", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const receipt = await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentId}/receipt`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(receipt.body.pdfDataUrl).toContain("data:application/pdf;base64,");

    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/finance/recovery")
      .query({ schoolYearId })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(dashboard.body.totals.amountDue).toBe(300000);
    expect(dashboard.body.totals.amountPaid).toBe(120000);
    expect(dashboard.body.totals.remainingAmount).toBe(180000);
  });

  it("POST /grades and /grades/bulk should capture notes", async () => {
    const teacherTokens = await login("scolarite@gestschool.local", "scolarite123");

    await request(app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        classId,
        subjectId,
        academicPeriodId,
        assessmentLabel: "Devoir 1",
        assessmentType: "DEVOIR",
        score: 16,
        scoreMax: 20
      })
      .expect(201);

    const bulk = await request(app.getHttpServer())
      .post("/api/v1/grades/bulk")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .send({
        classId,
        subjectId,
        academicPeriodId,
        assessmentLabel: "Composition",
        assessmentType: "COMPOSITION",
        scoreMax: 20,
        grades: [
          {
            studentId: studentOneId,
            score: 18
          },
          {
            studentId: studentTwoId,
            score: 12
          }
        ]
      })
      .expect(201);

    expect(bulk.body.upsertedCount).toBe(2);

    const list = await request(app.getHttpServer())
      .get("/api/v1/grades")
      .query({ classId, subjectId, academicPeriodId })
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);

    expect(list.body.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /grades/class-summary should compute averages and ranks", async () => {
    const teacherTokens = await login("scolarite@gestschool.local", "scolarite123");

    const summary = await request(app.getHttpServer())
      .get("/api/v1/grades/class-summary")
      .query({ classId, academicPeriodId })
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);

    expect(summary.body.students).toHaveLength(2);

    const ranked = [...summary.body.students].sort(
      (left, right) => left.classRank - right.classRank || right.averageGeneral - left.averageGeneral
    );

    expect(ranked[0].classRank).toBe(1);
    expect(ranked[0].averageGeneral).toBeGreaterThanOrEqual(ranked[1].averageGeneral);
  });

  it("POST /report-cards/generate and GET /report-cards/:id/pdf should return bulletin", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const report = await request(app.getHttpServer())
      .post("/api/v1/report-cards/generate")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        classId,
        academicPeriodId,
        publish: true
      })
      .expect(201);

    reportCardId = report.body.id;
    expect(report.body.pdfDataUrl).toContain("data:application/pdf;base64,");

    const pdf = await request(app.getHttpServer())
      .get(`/api/v1/report-cards/${reportCardId}/pdf`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(pdf.body.pdfDataUrl).toContain("data:application/pdf;base64,");
  });

  it("Sprint 5 should handle attendance, timetable and notifications", async () => {
    const scolariteTokens = await login("scolarite@gestschool.local", "scolarite123");

    const attendance = await request(app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        classId,
        attendanceDate: "2026-09-10",
        status: "ABSENT",
        reason: "Sick"
      })
      .expect(201);

    attendanceId = attendance.body.id;
    expect(attendance.body.schoolYearId).toBe(schoolYearId);

    const attendanceList = await request(app.getHttpServer())
      .get("/api/v1/attendance")
      .query({ classId, fromDate: "2026-09-01", toDate: "2026-09-30" })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(attendanceList.body.length).toBeGreaterThanOrEqual(1);

    const attendanceUpdated = await request(app.getHttpServer())
      .patch(`/api/v1/attendance/${attendanceId}`)
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({ status: "EXCUSED" })
      .expect(200);

    expect(attendanceUpdated.body.status).toBe("EXCUSED");

    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const timetableSlot = await request(app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        classId,
        subjectId,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "09:00",
        room: "A1",
        teacherName: "Mme Traore"
      })
      .expect(201);

    timetableSlotId = timetableSlot.body.id;
    expect(timetableSlot.body.schoolYearId).toBe(schoolYearId);

    const timetableList = await request(app.getHttpServer())
      .get("/api/v1/timetable-slots")
      .query({ classId })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(timetableList.body.length).toBeGreaterThanOrEqual(1);

    const notification = await request(app.getHttpServer())
      .post("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        title: "Rappel frais",
        message: "Merci de regulariser avant le 15/10.",
        audienceRole: "PARENT",
        channel: "IN_APP"
      })
      .expect(201);

    notificationId = notification.body.id;
    expect(notification.body.status).toBe("PENDING");

    const notificationSent = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/status`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({ status: "SENT" })
      .expect(200);

    expect(notificationSent.body.status).toBe("SENT");

    const notificationList = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .query({ status: "SENT" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(notificationList.body.some((item: { id: string }) => item.id === notificationId)).toBe(
      true
    );
  });

  it("Sprint 6 should handle bulk attendance, summaries, timetable conflicts and notification dispatch", async () => {
    const scolariteTokens = await login("scolarite@gestschool.local", "scolarite123");

    const bulkAttendance = await request(app.getHttpServer())
      .post("/api/v1/attendance/bulk")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        classId,
        attendanceDate: "2026-09-11",
        defaultStatus: "ABSENT",
        entries: [{ studentId: studentOneId }, { studentId: studentTwoId }]
      })
      .expect(201);

    expect(bulkAttendance.body.createdCount).toBe(2);
    expect(bulkAttendance.body.errorCount).toBe(0);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/attendance/summary")
      .query({ classId, fromDate: "2026-09-01", toDate: "2026-09-30" })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(summary.body.total).toBeGreaterThanOrEqual(2);
    expect(summary.body.byStatus.ABSENT).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(summary.body.topAbsentees)).toBe(true);

    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const autoNotifications = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .query({ studentId: studentOneId, audienceRole: "PARENT" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(
      autoNotifications.body.some((item: { title: string }) => item.title.includes("Alerte"))
    ).toBe(true);

    await request(app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        classId,
        subjectId,
        dayOfWeek: 1,
        startTime: "08:30",
        endTime: "09:30",
        room: "A2",
        teacherName: "Mme Traore"
      })
      .expect(409);

    const timetableGrid = await request(app.getHttpServer())
      .get("/api/v1/timetable-slots/grid")
      .query({ classId })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    const monday = timetableGrid.body.days.find((item: { dayOfWeek: number }) => item.dayOfWeek === 1);
    expect(monday).toBeDefined();
    expect(monday.slots.length).toBeGreaterThanOrEqual(1);

    const scheduledNotification = await request(app.getHttpServer())
      .post("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        title: "Rappel planning",
        message: "Notification planifiee a envoyer.",
        audienceRole: "PARENT",
        channel: "IN_APP",
        scheduledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      })
      .expect(201);

    expect(scheduledNotification.body.status).toBe("SCHEDULED");

    const dispatch = await request(app.getHttpServer())
      .post("/api/v1/notifications/dispatch-pending")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({ limit: 20 })
      .expect(201);

    expect(dispatch.body.dispatchedCount).toBeGreaterThanOrEqual(1);
    expect(
      dispatch.body.notifications.some(
        (item: { id: string; status: string }) =>
          item.id === scheduledNotification.body.id && item.status === "SENT"
      )
    ).toBe(true);
  });
  it("Sprint 6.1 should manage attendance attachments and validation workflow", async () => {
    const scolariteTokens = await login("scolarite@gestschool.local", "scolarite123");

    const attendance = await request(app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: studentTwoId,
        classId,
        attendanceDate: "2026-09-12",
        status: "ABSENT",
        reason: "Consultation"
      })
      .expect(201);

    expect(attendance.body.justificationStatus).toBe("PENDING");

    const attachment = await request(app.getHttpServer())
      .post(`/api/v1/attendance/${attendance.body.id}/attachments`)
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        fileName: "certificat-medical.pdf",
        fileUrl: "https://files.gestschool.local/certificat-medical.pdf",
        mimeType: "application/pdf"
      })
      .expect(201);

    attendanceAttachmentId = attachment.body.id;

    const attachmentList = await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendance.body.id}/attachments`)
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(attachmentList.body).toHaveLength(1);
    expect(attachmentList.body[0].id).toBe(attendanceAttachmentId);

    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const validated = await request(app.getHttpServer())
      .patch(`/api/v1/attendance/${attendance.body.id}/validation`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        status: "APPROVED",
        comment: "Justificatif valide"
      })
      .expect(200);

    expect(validated.body.justificationStatus).toBe("APPROVED");
    expect(validated.body.validationComment).toBe("Justificatif valide");

    const attendanceList = await request(app.getHttpServer())
      .get("/api/v1/attendance")
      .query({ studentId: studentTwoId, fromDate: "2026-09-12", toDate: "2026-09-12" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    const refreshed = attendanceList.body.find((item: { id: string }) => item.id === attendance.body.id);
    expect(refreshed).toBeDefined();
    expect(refreshed.justificationStatus).toBe("APPROVED");
    expect(refreshed.attachments.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/attendance/${attendance.body.id}/attachments/${attendanceAttachmentId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    const emptyAttachments = await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendance.body.id}/attachments`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(emptyAttachments.body).toHaveLength(0);
  });

  it("POST /auth/refresh should rotate refresh token", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const firstRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(201);

    expect(firstRefresh.body.accessToken).toBeDefined();
    expect(firstRefresh.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(401);
  });

  it("POST /auth/logout should revoke refresh token", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(401);
  });

  it("Sprint 7.1 should manage users and custom role permissions", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");
    const teacherTokens = await login("enseignant@gestschool.local", "teacher1234");

    await request(app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);

    const createdUser = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        username: "assistant@gestschool.local",
        password: "assist12345",
        role: "ENSEIGNANT"
      })
      .expect(201);
    managedUserId = createdUser.body.id;

    await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    const permissionUpdate = await request(app.getHttpServer())
      .put("/api/v1/users/roles/ENSEIGNANT/permissions")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        permissions: [{ resource: "students", action: "read", allowed: false }]
      })
      .expect(200);

    const studentsReadPermission = permissionUpdate.body.find(
      (item: { resource: string; action: string }) =>
        item.resource === "students" && item.action === "read"
    );
    expect(studentsReadPermission?.allowed).toBe(false);
    expect(studentsReadPermission?.source).toBe("CUSTOM");

    await request(app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${managedUserId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "assistant@gestschool.local",
        password: "assist12345",
        tenantId: TENANT_ID
      })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${managedUserId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(204);

    const auditRows = await prisma.iamAuditLog.findMany({
      where: {
        tenantId: TENANT_ID
      }
    });
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it("Sprint 7.2 should enforce teacher/parent portal scoping with assignments", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const teacherUser = await prisma.user.findFirst({
      where: {
        tenantId: TENANT_ID,
        username: "enseignant@gestschool.local",
        deletedAt: null
      }
    });
    const parentUser = await prisma.user.findFirst({
      where: {
        tenantId: TENANT_ID,
        username: "parent@gestschool.local",
        deletedAt: null
      }
    });

    expect(teacherUser?.id).toBeDefined();
    expect(parentUser?.id).toBeDefined();

    const teacherAssignment = await request(app.getHttpServer())
      .post("/api/v1/users/teacher-assignments")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        userId: teacherUser?.id,
        classId,
        schoolYearId,
        subjectId
      })
      .expect(201);
    teacherAssignmentId = teacherAssignment.body.id;

    const parentLink = await request(app.getHttpServer())
      .post("/api/v1/users/parent-links")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        parentUserId: parentUser?.id,
        studentId: studentOneId,
        relationship: "Pere",
        isPrimary: true
      })
      .expect(201);
    parentLinkId = parentLink.body.id;
    expect(teacherAssignmentId).toBeDefined();
    expect(parentLinkId).toBeDefined();

    const teacherTokens = await login("enseignant@gestschool.local", "teacher1234");

    const teacherClasses = await request(app.getHttpServer())
      .get("/api/v1/portal/teacher/classes")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);
    expect(teacherClasses.body.some((item: { classId: string }) => item.classId === classId)).toBe(
      true
    );

    await request(app.getHttpServer())
      .post("/api/v1/portal/teacher/grades")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .send({
        studentId: studentOneId,
        classId,
        subjectId,
        academicPeriodId,
        assessmentLabel: "Interro Sprint72",
        assessmentType: "DEVOIR",
        score: 14,
        scoreMax: 20
      })
      .expect(201);

    const extraClass = await request(app.getHttpServer())
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        schoolYearId,
        levelId,
        code: "CP1-B",
        label: "CP1 B",
        capacity: 30
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/v1/portal/teacher/students")
      .query({ classId: extraClass.body.id })
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(403);

    const parentTokens = await login("parent@gestschool.local", "parent1234");

    const children = await request(app.getHttpServer())
      .get("/api/v1/portal/parent/children")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    expect(
      children.body.some((item: { studentId: string }) => item.studentId === studentOneId)
    ).toBe(true);

    await request(app.getHttpServer())
      .get("/api/v1/portal/parent/grades")
      .query({ studentId: studentOneId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/portal/parent/grades")
      .query({ studentId: studentTwoId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);
  });

  it("Sprint 8.1 should manage mosque module with API permissions", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const member = await request(app.getHttpServer())
      .post("/api/v1/mosque/members")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        memberCode: "MOSQ-0001",
        fullName: "Imam Test",
        phone: "+2250707070707",
        status: "ACTIVE"
      })
      .expect(201);
    mosqueMemberId = member.body.id;

    const activity = await request(app.getHttpServer())
      .post("/api/v1/mosque/activities")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "ACT-0001",
        title: "Cours du soir",
        activityDate: "2026-03-10",
        category: "COURS",
        location: "Mosquee Blanche",
        isSchoolLinked: true
      })
      .expect(201);
    mosqueActivityId = activity.body.id;

    const donation = await request(app.getHttpServer())
      .post("/api/v1/mosque/donations")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        memberId: mosqueMemberId,
        amount: 5000,
        currency: "XOF",
        channel: "CASH",
        referenceNo: "DON-0001"
      })
      .expect(201);
    mosqueDonationId = donation.body.id;

    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/mosque/dashboard")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(dashboard.body.totals.members).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.totals.donationsTotal).toBeGreaterThanOrEqual(5000);

    const membersExport = await request(app.getHttpServer())
      .get("/api/v1/mosque/members/export")
      .query({ format: "EXCEL" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(membersExport.body.mimeType).toBe("application/vnd.ms-excel");
    expect(membersExport.body.fileName).toContain(".xls");

    const donationsExport = await request(app.getHttpServer())
      .get("/api/v1/mosque/donations/export")
      .query({ format: "PDF" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(donationsExport.body.dataUrl).toContain("data:application/pdf;base64,");

    const donationReceipt = await request(app.getHttpServer())
      .get(`/api/v1/mosque/donations/${mosqueDonationId}/receipt`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(donationReceipt.body.pdfDataUrl).toContain("data:application/pdf;base64,");
    expect(donationReceipt.body.receiptNo).toBeDefined();

    const members = await request(app.getHttpServer())
      .get("/api/v1/mosque/members")
      .query({ status: "ACTIVE" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(members.body.some((item: { id: string }) => item.id === mosqueMemberId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/mosque/donations/${mosqueDonationId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        amount: 7000,
        channel: "BANK"
      })
      .expect(200);

    const comptableTokens = await login("comptable@gestschool.local", "comptable123");
    await request(app.getHttpServer())
      .get("/api/v1/mosque/dashboard")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .expect(200);

    const parentTokens = await login("parent@gestschool.local", "parent1234");
    await request(app.getHttpServer())
      .get("/api/v1/mosque/dashboard")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/mosque/donations/${mosqueDonationId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    mosqueDonationId = "";

    await request(app.getHttpServer())
      .delete(`/api/v1/mosque/activities/${mosqueActivityId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    mosqueActivityId = "";

    await request(app.getHttpServer())
      .delete(`/api/v1/mosque/members/${mosqueMemberId}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    mosqueMemberId = "";
  });

  it("Sprint 9 should dispatch external notifications with deliverability status", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const created = await request(app.getHttpServer())
      .post("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        title: "Alerte paiement",
        message: "Merci de regulariser cette semaine.",
        audienceRole: "PARENT",
        channel: "EMAIL",
        targetAddress: "parent.demo@example.com"
      })
      .expect(201);

    expect(created.body.deliveryStatus).toBe("QUEUED");
    expect(created.body.attempts).toBe(0);

    const dispatched = await request(app.getHttpServer())
      .post("/api/v1/notifications/dispatch-pending")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({ limit: 50 })
      .expect(201);

    const current = dispatched.body.notifications.find(
      (item: { id: string }) => item.id === created.body.id
    );
    expect(current).toBeDefined();
    expect(current.attempts).toBeGreaterThanOrEqual(1);
    expect(current.provider).toBeDefined();
    expect(current.providerMessageId).toBeDefined();
    expect(["DELIVERED", "SENT_TO_PROVIDER"]).toContain(current.deliveryStatus);

    const callback = await request(app.getHttpServer())
      .post("/api/v1/notifications/delivery-events")
      .set("x-notification-webhook-secret", "test-webhook-secret")
      .send({
        providerMessageId: current.providerMessageId,
        provider: current.provider,
        status: "DELIVERED"
      })
      .expect(201);

    expect(callback.body.status).toBe("SENT");
    expect(callback.body.deliveryStatus).toBe("DELIVERED");
    expect(callback.body.deliveredAt).toBeDefined();
  });

  it("Sprint 10 should expose readiness, metrics and storage descriptor endpoints", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const live = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .expect(200);
    expect(live.body.status).toBe("live");

    const ready = await request(app.getHttpServer())
      .get("/api/v1/health/ready")
      .expect(200);
    expect(ready.body.status).toBe("ready");

    const metrics = await request(app.getHttpServer())
      .get("/api/v1/monitoring/metrics")
      .expect(200);
    expect(metrics.text).toContain("gestschool_process_uptime_seconds");

    const descriptor = await request(app.getHttpServer())
      .post("/api/v1/storage/upload-descriptor")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        fileName: "justificatif-absence.pdf",
        mimeType: "application/pdf",
        folder: "attendance/justificatifs"
      })
      .expect(201);

    expect(descriptor.body.driver).toBeDefined();
    expect(descriptor.body.key).toContain(TENANT_ID);
    expect(descriptor.body.fileUrl).toContain("/files/");
    expect(descriptor.body.uploadUrl).toBeDefined();
  });

  it("Sprint 11 should expose analytics overview and compliance audit exports", async () => {
    const adminTokens = await login("admin@gestschool.local", "admin12345");

    const overview = await request(app.getHttpServer())
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(overview.body.generatedAt).toBeDefined();
    expect(overview.body.finance).toBeDefined();
    expect(Array.isArray(overview.body.trends?.payments)).toBe(true);

    const auditPage = await request(app.getHttpServer())
      .get("/api/v1/analytics/compliance/audit-logs?page=1&pageSize=20")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(auditPage.body.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(auditPage.body.items)).toBe(true);

    const auditExport = await request(app.getHttpServer())
      .get("/api/v1/analytics/compliance/audit-logs/export?format=EXCEL")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);
    expect(auditExport.body.mimeType).toBe("application/vnd.ms-excel");
    expect(auditExport.body.dataUrl).toContain("data:application/vnd.ms-excel;base64,");

    const parentTokens = await login("parent@gestschool.local", "parent1234");
    await request(app.getHttpServer())
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);
  });

  async function login(
    username: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username, password, tenantId: TENANT_ID })
      .expect(201);

    return {
      accessToken: response.body.accessToken,
      refreshToken: response.body.refreshToken
    };
  }

  async function cleanDatabase(): Promise<void> {
    await prisma.refreshToken.deleteMany({});
    await prisma.iamAuditLog.deleteMany({});
    await prisma.teacherClassAssignment.deleteMany({});
    await prisma.parentStudentLink.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.mosqueDonation.deleteMany({});
    await prisma.mosqueActivity.deleteMany({});
    await prisma.mosqueMember.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.attendanceAttachment.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.timetableSlot.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.feePlan.deleteMany({});
    await prisma.reportCard.deleteMany({});
    await prisma.gradeEntry.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.academicPeriod.deleteMany({});
    await prisma.subject.deleteMany({});
    await prisma.classroom.deleteMany({});
    await prisma.level.deleteMany({});
    await prisma.cycle.deleteMany({});
    await prisma.schoolYear.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});
  }

  async function seedUsers(): Promise<void> {
    const users = [
      {
        username: "admin@gestschool.local",
        password: "admin12345",
        role: UserRole.ADMIN
      },
      {
        username: "scolarite@gestschool.local",
        password: "scolarite123",
        role: UserRole.SCOLARITE
      },
      {
        username: "comptable@gestschool.local",
        password: "comptable123",
        role: UserRole.COMPTABLE
      },
      {
        username: "enseignant@gestschool.local",
        password: "teacher1234",
        role: UserRole.ENSEIGNANT
      },
      {
        username: "parent@gestschool.local",
        password: "parent1234",
        role: UserRole.PARENT
      }
    ];

    for (const user of users) {
      const passwordHash = await hash(user.password, 10);
      await prisma.user.create({
        data: {
          tenantId: TENANT_ID,
          username: user.username,
          passwordHash,
          role: user.role
        }
      });
    }
  }
});

