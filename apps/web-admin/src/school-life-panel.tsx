import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type StudentRef = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
};

type ClassRef = {
  id: string;
  code: string;
  label: string;
};

type SubjectRef = {
  id: string;
  code: string;
  label: string;
};

type AttendanceAttachment = {
  id: string;
  attendanceId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedByUserId?: string;
  createdAt: string;
};

type AttendanceRecord = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  attendanceDate: string;
  status: string;
  reason?: string;
  justificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  validationComment?: string;
  validatedByUserId?: string;
  validatedAt?: string;
  attachments: AttendanceAttachment[];
  studentName?: string;
  classLabel?: string;
};

type AttendanceSummary = {
  total: number;
  byStatus: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
  absenceRatePercent: number;
  topAbsentees: Array<{
    studentId: string;
    studentName: string;
    absentCount: number;
  }>;
};
type TimetableSlot = {
  id: string;
  classId: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacherName?: string;
  classLabel?: string;
  subjectLabel?: string;
};

type TimetableGrid = {
  classId?: string;
  schoolYearId?: string;
  days: Array<{
    dayOfWeek: number;
    dayLabel: string;
    slots: TimetableSlot[];
  }>;
};
type NotificationItem = {
  id: string;
  studentId?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  targetAddress?: string;
  provider?: string;
  providerMessageId?: string;
  deliveryStatus: string;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  studentName?: string;
};

type BulkAttendanceResponse = {
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    studentId: string;
    message: string;
  }>;
};

type DispatchResult = {
  dispatchedCount: number;
  notifications: NotificationItem[];
};

type SchoolLifeFocus = "all" | "overview" | "attendance" | "timetable" | "notifications";

type SchoolLifePanelProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  students: StudentRef[];
  classes: ClassRef[];
  subjects: SubjectRef[];
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  focusSection?: SchoolLifeFocus;
  readOnly?: boolean;
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // ignore
  }
  return `Erreur HTTP ${response.status}`;
};

const dayLabels = new Map<number, string>([
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"]
]);

export function SchoolLifePanel(props: SchoolLifePanelProps): JSX.Element {
  const {
    api,
    students,
    classes,
    subjects,
    onError,
    onNotice,
    focusSection = "all",
    readOnly = false
  } = props;

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [timetableGrid, setTimetableGrid] = useState<TimetableGrid | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [attendanceFilters, setAttendanceFilters] = useState({
    classId: "",
    studentId: "",
    status: "",
    fromDate: "",
    toDate: ""
  });
  const [attendanceForm, setAttendanceForm] = useState({
    studentId: "",
    classId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    reason: ""
  });
  const [bulkAttendanceForm, setBulkAttendanceForm] = useState({
    classId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    defaultStatus: "ABSENT",
    reason: "",
    studentIds: [] as string[]
  });

  const [selectedAttendanceId, setSelectedAttendanceId] = useState("");
  const [attendanceAttachments, setAttendanceAttachments] = useState<AttendanceAttachment[]>([]);
  const [attachmentForm, setAttachmentForm] = useState({
    fileName: "",
    fileUrl: "",
    mimeType: "application/pdf"
  });
  const [validationForm, setValidationForm] = useState({
    status: "PENDING" as "PENDING" | "APPROVED" | "REJECTED",
    comment: ""
  });

  const [timetableFilters, setTimetableFilters] = useState({ classId: "", dayOfWeek: "" });
  const [timetableForm, setTimetableForm] = useState({
    classId: "",
    subjectId: "",
    dayOfWeek: "1",
    startTime: "08:00",
    endTime: "09:00",
    room: "",
    teacherName: ""
  });

  const [notificationFilters, setNotificationFilters] = useState({
    status: "",
    channel: "",
    deliveryStatus: ""
  });
  const [notificationForm, setNotificationForm] = useState({
    studentId: "",
    audienceRole: "PARENT",
    title: "",
    message: "",
    channel: "IN_APP",
    targetAddress: "",
    scheduledAt: ""
  });

  useEffect(() => {
    if (!attendanceForm.studentId && students[0]) {
      setAttendanceForm((prev) => ({ ...prev, studentId: students[0].id }));
    }
    if (!attendanceForm.classId && classes[0]) {
      setAttendanceForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!bulkAttendanceForm.classId && classes[0]) {
      setBulkAttendanceForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!timetableForm.classId && classes[0]) {
      setTimetableForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!timetableForm.subjectId && subjects[0]) {
      setTimetableForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    }
    if (!notificationForm.studentId && students[0]) {
      setNotificationForm((prev) => ({ ...prev, studentId: students[0].id }));
    }
  }, [
    attendanceForm.classId,
    attendanceForm.studentId,
    bulkAttendanceForm.classId,
    classes,
    notificationForm.studentId,
    students,
    subjects,
    timetableForm.classId,
    timetableForm.subjectId
  ]);

  useEffect(() => {
    if (attendanceRecords.length === 0) {
      if (selectedAttendanceId) {
        setSelectedAttendanceId("");
      }
      setAttendanceAttachments([]);
      setValidationForm({ status: "PENDING", comment: "" });
      return;
    }

    const selected = attendanceRecords.find((item) => item.id === selectedAttendanceId);
    if (selected) {
      setValidationForm({
        status: selected.justificationStatus,
        comment: selected.validationComment || ""
      });
      return;
    }

    setSelectedAttendanceId(attendanceRecords[0].id);
  }, [attendanceRecords, selectedAttendanceId]);

  const loadAttendance = useCallback(
    async (filters = attendanceFilters) => {
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      if (filters.status) query.set("status", filters.status);
      if (filters.fromDate) query.set("fromDate", filters.fromDate);
      if (filters.toDate) query.set("toDate", filters.toDate);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/attendance${suffix}`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setAttendanceRecords((await response.json()) as AttendanceRecord[]);
    },
    [api, attendanceFilters, onError]
  );

  const loadAttendanceSummary = useCallback(
    async (filters = attendanceFilters) => {
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.fromDate) query.set("fromDate", filters.fromDate);
      if (filters.toDate) query.set("toDate", filters.toDate);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/attendance/summary${suffix}`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setAttendanceSummary((await response.json()) as AttendanceSummary);
    },
    [api, attendanceFilters, onError]
  );
  const loadAttendanceAttachments = useCallback(
    async (attendanceId = selectedAttendanceId) => {
      if (!attendanceId) {
        setAttendanceAttachments([]);
        return;
      }

      const response = await api(`/attendance/${attendanceId}/attachments`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setAttendanceAttachments((await response.json()) as AttendanceAttachment[]);
    },
    [api, onError, selectedAttendanceId]
  );

  useEffect(() => {
    const needsAttendance =
      focusSection === "all" || focusSection === "overview" || focusSection === "attendance";

    if (!needsAttendance || !selectedAttendanceId) {
      return;
    }

    void loadAttendanceAttachments(selectedAttendanceId);
  }, [focusSection, loadAttendanceAttachments, selectedAttendanceId]);

  const loadTimetableSlots = useCallback(
    async (filters = timetableFilters) => {
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.dayOfWeek) query.set("dayOfWeek", filters.dayOfWeek);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/timetable-slots${suffix}`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setTimetableSlots((await response.json()) as TimetableSlot[]);
    },
    [api, onError, timetableFilters]
  );

  const loadTimetableGrid = useCallback(
    async (filters = timetableFilters) => {
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/timetable-slots/grid${suffix}`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setTimetableGrid((await response.json()) as TimetableGrid);
    },
    [api, onError, timetableFilters]
  );
  const loadNotifications = useCallback(
    async (filters = notificationFilters) => {
      const query = new URLSearchParams();
      if (filters.status) query.set("status", filters.status);
      if (filters.channel) query.set("channel", filters.channel);
      if (filters.deliveryStatus) query.set("deliveryStatus", filters.deliveryStatus);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/notifications${suffix}`);
      if (!response.ok) {
        onError(await parseError(response));
        return;
      }

      setNotifications((await response.json()) as NotificationItem[]);
    },
    [api, notificationFilters, onError]
  );

  useEffect(() => {
    const needsAttendance =
      focusSection === "all" || focusSection === "overview" || focusSection === "attendance";
    const needsTimetable =
      focusSection === "all" || focusSection === "overview" || focusSection === "timetable";
    const needsNotifications =
      focusSection === "all" || focusSection === "overview" || focusSection === "notifications";

    if (needsAttendance) {
      void loadAttendance();
      void loadAttendanceSummary();
    }
    if (needsTimetable) {
      void loadTimetableSlots();
      void loadTimetableGrid();
    }
    if (needsNotifications) {
      void loadNotifications();
    }
  }, [
    focusSection,
    loadAttendance,
    loadAttendanceSummary,
    loadNotifications,
    loadTimetableGrid,
    loadTimetableSlots
  ]);

  const rejectReadOnly = (): boolean => {
    if (!readOnly) return false;
    onError("Action non autorisee en mode lecture seule.");
    return true;
  };

  const submitAttendance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    const response = await api("/attendance", {
      method: "POST",
      body: JSON.stringify({
        studentId: attendanceForm.studentId,
        classId: attendanceForm.classId,
        attendanceDate: attendanceForm.attendanceDate,
        status: attendanceForm.status,
        reason: attendanceForm.reason || undefined
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    const created = (await response.json()) as AttendanceRecord;

    onNotice("Absence enregistree.");
    setAttendanceForm((prev) => ({ ...prev, reason: "" }));
    setSelectedAttendanceId(created.id);
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const deleteAttendance = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!window.confirm("Supprimer cette ligne d'absence ?")) return;
    const response = await api(`/attendance/${id}`, { method: "DELETE" });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Absence supprimee.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const applyAttendanceFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const resetAttendanceFilters = async (): Promise<void> => {
    const next = { classId: "", studentId: "", status: "", fromDate: "", toDate: "" };
    setAttendanceFilters(next);
    await loadAttendance(next);
    await loadAttendanceSummary(next);
  };

  const submitAttendanceAttachment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError("Selectionner une ligne d'absence pour ajouter un justificatif.");
      return;
    }

    const fileName = attachmentForm.fileName.trim();
    const fileUrl = attachmentForm.fileUrl.trim();
    if (!fileName || !fileUrl) {
      onError("Renseigner le nom du fichier et son URL.");
      return;
    }

    const response = await api(`/attendance/${selectedAttendanceId}/attachments`, {
      method: "POST",
      body: JSON.stringify({
        fileName,
        fileUrl,
        mimeType: attachmentForm.mimeType.trim() || undefined
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Justificatif ajoute.");
    setAttachmentForm((prev) => ({ ...prev, fileName: "", fileUrl: "" }));
    await loadAttendance(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const removeAttendanceAttachment = async (attachmentId: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!selectedAttendanceId) {
      return;
    }

    if (!window.confirm("Supprimer ce justificatif ?")) {
      return;
    }

    const response = await api(
      `/attendance/${selectedAttendanceId}/attachments/${attachmentId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Justificatif supprime.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const submitAttendanceValidation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError("Selectionner une ligne d'absence a valider.");
      return;
    }

    const response = await api(`/attendance/${selectedAttendanceId}/validation`, {
      method: "PATCH",
      body: JSON.stringify({
        status: validationForm.status,
        comment: validationForm.comment.trim() || undefined
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    const updated = (await response.json()) as AttendanceRecord;
    setValidationForm({
      status: updated.justificationStatus,
      comment: updated.validationComment || ""
    });
    onNotice("Validation mise a jour.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const submitBulkAttendance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (bulkAttendanceForm.studentIds.length === 0) {
      onError("Selectionner au moins un eleve pour la saisie en masse.");
      return;
    }

    const response = await api("/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        classId: bulkAttendanceForm.classId,
        attendanceDate: bulkAttendanceForm.attendanceDate,
        defaultStatus: bulkAttendanceForm.defaultStatus,
        entries: bulkAttendanceForm.studentIds.map((studentId) => ({
          studentId,
          reason: bulkAttendanceForm.reason || undefined
        }))
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as BulkAttendanceResponse;
    onNotice(
      `Saisie de masse terminee: ${payload.createdCount} cree(s), ${payload.updatedCount} maj, ${payload.errorCount} erreur(s).`
    );

    if (payload.errorCount > 0 && payload.errors[0]) {
      onError(`Premier echec: ${payload.errors[0].studentId} - ${payload.errors[0].message}`);
    }

    setBulkAttendanceForm((prev) => ({ ...prev, studentIds: [], reason: "" }));
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };
  const submitTimetableSlot = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    const response = await api("/timetable-slots", {
      method: "POST",
      body: JSON.stringify({
        classId: timetableForm.classId,
        subjectId: timetableForm.subjectId,
        dayOfWeek: Number(timetableForm.dayOfWeek),
        startTime: timetableForm.startTime,
        endTime: timetableForm.endTime,
        room: timetableForm.room || undefined,
        teacherName: timetableForm.teacherName || undefined
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Cours ajoute a l'emploi du temps.");
    setTimetableForm((prev) => ({ ...prev, room: "", teacherName: "" }));
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const deleteTimetableSlot = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!window.confirm("Supprimer ce cours ?")) return;
    const response = await api(`/timetable-slots/${id}`, { method: "DELETE" });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Cours supprime.");
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const applyTimetableFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const resetTimetableFilters = async (): Promise<void> => {
    const next = { classId: "", dayOfWeek: "" };
    setTimetableFilters(next);
    await loadTimetableSlots(next);
    await loadTimetableGrid(next);
  };

  const submitNotification = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    const response = await api("/notifications", {
      method: "POST",
      body: JSON.stringify({
        studentId: notificationForm.studentId || undefined,
        audienceRole: notificationForm.audienceRole || undefined,
        title: notificationForm.title.trim(),
        message: notificationForm.message.trim(),
        channel: notificationForm.channel,
        targetAddress: notificationForm.targetAddress.trim() || undefined,
        scheduledAt: notificationForm.scheduledAt
          ? new Date(notificationForm.scheduledAt).toISOString()
          : undefined
      })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Notification creee.");
    setNotificationForm((prev) => ({
      ...prev,
      title: "",
      message: "",
      targetAddress: "",
      scheduledAt: ""
    }));
    await loadNotifications(notificationFilters);
  };

  const dispatchPendingNotifications = async (): Promise<void> => {
    if (rejectReadOnly()) return;
    const response = await api("/notifications/dispatch-pending", {
      method: "POST",
      body: JSON.stringify({ limit: 150 })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as DispatchResult;
    onNotice(`${payload.dispatchedCount} notification(s) envoyee(s).`);
    await loadNotifications(notificationFilters);
  };
  const markNotificationAsSent = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    const response = await api(`/notifications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "SENT" })
    });

    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    onNotice("Notification marquee comme envoyee.");
    await loadNotifications(notificationFilters);
  };

  const applyNotificationFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadNotifications(notificationFilters);
  };

  const resetNotificationFilters = async (): Promise<void> => {
    const next = { status: "", channel: "", deliveryStatus: "" };
    setNotificationFilters(next);
    await loadNotifications(next);
  };

  const attendanceMetrics = useMemo(() => {
    if (attendanceSummary) {
      return {
        total: attendanceSummary.total,
        present: attendanceSummary.byStatus.PRESENT,
        absent: attendanceSummary.byStatus.ABSENT,
        late: attendanceSummary.byStatus.LATE,
        excused: attendanceSummary.byStatus.EXCUSED,
        rate: attendanceSummary.absenceRatePercent
      };
    }

    const total = attendanceRecords.length;
    const present = attendanceRecords.filter((item) => item.status === "PRESENT").length;
    const absent = attendanceRecords.filter((item) => item.status === "ABSENT").length;
    const late = attendanceRecords.filter((item) => item.status === "LATE").length;
    const excused = attendanceRecords.filter((item) => item.status === "EXCUSED").length;
    const rate = total === 0 ? 0 : Number((((absent + late) / total) * 100).toFixed(2));

    return { total, present, absent, late, excused, rate };
  }, [attendanceRecords, attendanceSummary]);

  const topAbsentees = attendanceSummary?.topAbsentees ?? [];
  const selectedAttendance = attendanceRecords.find((item) => item.id === selectedAttendanceId) || null;
  return (
    <div className={`school-life-root focus-${focusSection}${readOnly ? " read-only" : ""}`}>
      <section className="panel table-panel">
        <div className="headline-row">
          <h2>Pilotage vie scolaire</h2>
          <span className="subtle">Sprint 5-6.1</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card"><span>Total pointages</span><strong>{attendanceMetrics.total}</strong></div>
          <div className="metric-card"><span>Presents</span><strong>{attendanceMetrics.present}</strong></div>
          <div className="metric-card"><span>Absents</span><strong>{attendanceMetrics.absent}</strong></div>
          <div className="metric-card"><span>Retards</span><strong>{attendanceMetrics.late}</strong></div>
          <div className="metric-card"><span>Excuses</span><strong>{attendanceMetrics.excused}</strong></div>
          <div className="metric-card"><span>Taux absence+retard</span><strong>{attendanceMetrics.rate}%</strong></div>
        </div>
        <div className="mini-list">
          {topAbsentees.length === 0 ? (
            <div className="mini-item"><span>Aucun eleve recurrent en absence sur la periode.</span></div>
          ) : (
            topAbsentees.map((item) => (
              <div key={item.studentId} className="mini-item">
                <span>{item.studentName}</span>
                <strong>{item.absentCount} absence(s)</strong>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="panel editor-panel">
        <h2>Absences</h2>
        <form className="form-grid" onSubmit={(event) => void submitAttendance(event)}>
          <label>
            Eleve
            <select value={attendanceForm.studentId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, studentId: event.target.value }))} required>
              <option value="">Choisir...</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>
          <label>
            Classe
            <select value={attendanceForm.classId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required>
              <option value="">Choisir...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={attendanceForm.attendanceDate} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required />
          </label>
          <label>
            Statut
            <select value={attendanceForm.status} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="PRESENT">PRESENT</option>
              <option value="ABSENT">ABSENT</option>
              <option value="LATE">LATE</option>
              <option value="EXCUSED">EXCUSED</option>
            </select>
          </label>
          <label>
            Motif
            <input value={attendanceForm.reason} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} />
          </label>
          <button type="submit">Enregistrer</button>
        </form>
      </section>

      <section className="panel editor-panel">
        <h2>Absences - saisie de masse</h2>
        <form className="form-grid" onSubmit={(event) => void submitBulkAttendance(event)}>
          <div className="split-grid">
            <label>Classe<select value={bulkAttendanceForm.classId} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required><option value="">Choisir...</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
            <label>Date<input type="date" value={bulkAttendanceForm.attendanceDate} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required /></label>
            <label>Statut<select value={bulkAttendanceForm.defaultStatus} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, defaultStatus: event.target.value }))}><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option><option value="LATE">LATE</option><option value="EXCUSED">EXCUSED</option></select></label>
            <label>Motif global<input value={bulkAttendanceForm.reason} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} /></label>
          </div>
          <label>
            Eleves concernes
            <select
              multiple
              className="multi-select"
              value={bulkAttendanceForm.studentIds}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                setBulkAttendanceForm((prev) => ({ ...prev, studentIds: selected }));
              }}
              required
            >
              {students.map((item) => (
                <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>
          <p className="subtle hint">Ctrl/Cmd + clic pour multi-selection.</p>
          <button type="submit">Enregistrer en masse</button>
        </form>
      </section>
      <section className="panel table-panel">
        <div className="table-header">
          <h2>Journal des absences</h2>
          <span className="subtle">Filtre rapide, puis actions sur chaque ligne.</span>
        </div>
        <form className="filter-grid" onSubmit={(event) => void applyAttendanceFilters(event)}>
          <label>Classe<select value={attendanceFilters.classId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Toutes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Eleve<select value={attendanceFilters.studentId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">Tous</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule}</option>)}</select></label>
          <label>Statut<select value={attendanceFilters.status} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Tous</option><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option><option value="LATE">LATE</option><option value="EXCUSED">EXCUSED</option></select></label>
          <label>Du<input type="date" value={attendanceFilters.fromDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, fromDate: event.target.value }))} /></label>
          <label>Au<input type="date" value={attendanceFilters.toDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, toDate: event.target.value }))} /></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetAttendanceFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Eleve</th><th>Classe</th><th>Statut</th><th>Workflow</th><th>Validation</th><th>Pieces</th><th>Motif</th><th>Action</th></tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr><td colSpan={9} className="empty-row">Aucune ligne.</td></tr>
              ) : (
                attendanceRecords.map((item) => (
                  <tr key={item.id}>
                    <td>{item.attendanceDate}</td>
                    <td>{item.studentName || "-"}</td>
                    <td>{item.classLabel || "-"}</td>
                    <td>{item.status}</td>
                    <td>{item.justificationStatus}</td>
                    <td>
                      {item.validatedAt
                        ? `${new Date(item.validatedAt).toLocaleString("fr-FR")}${item.validationComment ? ` | ${item.validationComment}` : ""}`
                        : item.validationComment || "-"}
                    </td>
                    <td>{item.attachments?.length ?? 0}</td>
                    <td>{item.reason || "-"}</td>
                    <td><button type="button" className="button-danger" onClick={() => void deleteAttendance(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel editor-panel">
        <h2>Justificatifs & validation</h2>
        <p className="subtle">Selectionne une absence, valide le workflow puis rattache les pieces justificatives.</p>
        <h3>Workflow de validation</h3>
        <form className="form-grid" onSubmit={(event) => void submitAttendanceValidation(event)}>
          <div className="split-grid">
            <label>
              Pointage cible
              <select value={selectedAttendanceId} onChange={(event) => setSelectedAttendanceId(event.target.value)}>
                <option value="">Choisir...</option>
                {attendanceRecords.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.attendanceDate} - {item.studentName || item.studentId} ({item.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Statut workflow
              <select
                value={validationForm.status}
                onChange={(event) =>
                  setValidationForm((prev) => ({
                    ...prev,
                    status: event.target.value as "PENDING" | "APPROVED" | "REJECTED"
                  }))
                }
                disabled={!selectedAttendanceId}
              >
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </label>
            <label>
              Commentaire validation
              <input
                value={validationForm.comment}
                onChange={(event) =>
                  setValidationForm((prev) => ({ ...prev, comment: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>Enregistrer validation</button>
          </div>
        </form>

        <h3>Ajout de justificatif</h3>
        <form className="form-grid" onSubmit={(event) => void submitAttendanceAttachment(event)}>
          <div className="split-grid">
            <label>
              Nom du fichier
              <input
                value={attachmentForm.fileName}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, fileName: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
            <label>
              URL du justificatif
              <input
                value={attachmentForm.fileUrl}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, fileUrl: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
            <label>
              MIME type
              <input
                value={attachmentForm.mimeType}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, mimeType: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>Ajouter justificatif</button>
          </div>
        </form>

        <h3>Liste des justificatifs</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fichier</th><th>MIME</th><th>Ajoute le</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!selectedAttendanceId ? (
                <tr><td colSpan={4} className="empty-row">Selectionner une absence.</td></tr>
              ) : attendanceAttachments.length === 0 ? (
                <tr><td colSpan={4} className="empty-row">Aucun justificatif.</td></tr>
              ) : (
                attendanceAttachments.map((item) => (
                  <tr key={item.id}>
                    <td><a href={item.fileUrl} target="_blank" rel="noreferrer">{item.fileName}</a></td>
                    <td>{item.mimeType || "-"}</td>
                    <td>{new Date(item.createdAt).toLocaleString("fr-FR")}</td>
                    <td><button type="button" className="button-danger" onClick={() => void removeAttendanceAttachment(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedAttendance ? (
          <p className="subtle">Selection: {selectedAttendance.studentName || selectedAttendance.studentId} - {selectedAttendance.attendanceDate}</p>
        ) : null}
      </section>

      <section className="panel editor-panel">
        <h2>Emploi du temps</h2>
        <form className="form-grid" onSubmit={(event) => void submitTimetableSlot(event)}>
          <label>Classe<select value={timetableForm.classId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, classId: event.target.value }))} required>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>Matiere<select value={timetableForm.subjectId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, subjectId: event.target.value }))} required>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>Jour<select value={timetableForm.dayOfWeek} onChange={(event) => setTimetableForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <label>Debut<input type="time" value={timetableForm.startTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, startTime: event.target.value }))} required /></label>
          <label>Fin<input type="time" value={timetableForm.endTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, endTime: event.target.value }))} required /></label>
          <label>Salle<input value={timetableForm.room} onChange={(event) => setTimetableForm((prev) => ({ ...prev, room: event.target.value }))} /></label>
          <label>Enseignant<input value={timetableForm.teacherName} onChange={(event) => setTimetableForm((prev) => ({ ...prev, teacherName: event.target.value }))} /></label>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>Grille d'emploi du temps</h2>
          <span className="subtle">Recherche par classe et par jour.</span>
        </div>
        <form className="filter-grid" onSubmit={(event) => void applyTimetableFilters(event)}>
          <label>Classe<select value={timetableFilters.classId} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Toutes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Jour<select value={timetableFilters.dayOfWeek} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">Tous</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetTimetableFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Jour</th><th>Heure</th><th>Classe</th><th>Matiere</th><th>Salle</th><th>Enseignant</th><th>Action</th></tr>
            </thead>
            <tbody>
              {timetableSlots.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">Aucun cours.</td></tr>
              ) : (
                timetableSlots.map((item) => (
                  <tr key={item.id}>
                    <td>{dayLabels.get(item.dayOfWeek) || item.dayOfWeek}</td>
                    <td>{item.startTime} - {item.endTime}</td>
                    <td>{item.classLabel || "-"}</td>
                    <td>{item.subjectLabel || "-"}</td>
                    <td>{item.room || "-"}</td>
                    <td>{item.teacherName || "-"}</td>
                    <td><button type="button" className="button-danger" onClick={() => void deleteTimetableSlot(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>Vue hebdo</h3>
        <div className="day-grid">
          {(timetableGrid?.days || []).map((day) => (
            <article key={day.dayOfWeek} className="day-card">
              <h4>{day.dayLabel}</h4>
              {day.slots.length === 0 ? (
                <p className="subtle">Aucun cours</p>
              ) : (
                <div className="mini-list">
                  {day.slots.map((slot) => (
                    <div key={slot.id} className="slot-chip">
                      <strong>{slot.startTime} - {slot.endTime}</strong>
                      <span>{slot.subjectLabel || "-"}</span>
                      <small>{slot.classLabel || "-"} {slot.room ? `| ${slot.room}` : ""}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel editor-panel">
        <div className="headline-row">
          <h2>Notifications</h2>
          <div className="inline-actions">
            <button type="button" className="button-ghost" onClick={() => void dispatchPendingNotifications()}>
              Envoyer les notifications en attente
            </button>
          </div>
        </div>
        <form className="form-grid" onSubmit={(event) => void submitNotification(event)}>
          <label>Titre<input value={notificationForm.title} onChange={(event) => setNotificationForm((prev) => ({ ...prev, title: event.target.value }))} required /></label>
          <label>Message<input value={notificationForm.message} onChange={(event) => setNotificationForm((prev) => ({ ...prev, message: event.target.value }))} required /></label>
          <label>Audience<select value={notificationForm.audienceRole} onChange={(event) => setNotificationForm((prev) => ({ ...prev, audienceRole: event.target.value }))}><option value="">Aucun</option><option value="PARENT">PARENT</option><option value="ENSEIGNANT">ENSEIGNANT</option><option value="SCOLARITE">SCOLARITE</option><option value="COMPTABLE">COMPTABLE</option></select></label>
          <label>Eleve<select value={notificationForm.studentId} onChange={(event) => setNotificationForm((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">Aucun</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>)}</select></label>
          <label>Canal<select value={notificationForm.channel} onChange={(event) => setNotificationForm((prev) => ({ ...prev, channel: event.target.value }))}><option value="IN_APP">IN_APP</option><option value="EMAIL">EMAIL</option><option value="SMS">SMS</option></select></label>
          <label>Cible explicite<input value={notificationForm.targetAddress} onChange={(event) => setNotificationForm((prev) => ({ ...prev, targetAddress: event.target.value }))} placeholder="email@exemple.com ou +2250707070707" /></label>
          <label>Planifiee<input type="datetime-local" value={notificationForm.scheduledAt} onChange={(event) => setNotificationForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} /></label>
          <button type="submit">Creer</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>Historique notifications</h2>
          <span className="subtle">Suivi des envois, statuts et relances.</span>
        </div>
        <form className="filter-grid" onSubmit={(event) => void applyNotificationFilters(event)}>
          <label>Statut<select value={notificationFilters.status} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Tous</option><option value="PENDING">PENDING</option><option value="SCHEDULED">SCHEDULED</option><option value="SENT">SENT</option><option value="FAILED">FAILED</option></select></label>
          <label>Canal<select value={notificationFilters.channel} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, channel: event.target.value }))}><option value="">Tous</option><option value="IN_APP">IN_APP</option><option value="EMAIL">EMAIL</option><option value="SMS">SMS</option></select></label>
          <label>Delivery<select value={notificationFilters.deliveryStatus} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, deliveryStatus: event.target.value }))}><option value="">Tous</option><option value="QUEUED">QUEUED</option><option value="SENT_TO_PROVIDER">SENT_TO_PROVIDER</option><option value="DELIVERED">DELIVERED</option><option value="RETRYING">RETRYING</option><option value="FAILED">FAILED</option><option value="UNDELIVERABLE">UNDELIVERABLE</option></select></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetNotificationFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Titre</th><th>Canal</th><th>Statut</th><th>Delivery</th><th>Cible</th><th>Provider</th><th>Tentatives</th><th>Planifiee</th><th>Envoyee</th><th>Action</th></tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">Aucune notification.</td></tr>
              ) : (
                notifications.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.channel}</td>
                    <td>{item.status}</td>
                    <td>{item.deliveryStatus}</td>
                    <td>{item.targetAddress || item.studentName || item.audienceRole || "-"}</td>
                    <td>{item.provider || "-"}</td>
                    <td>{item.attempts}</td>
                    <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("fr-FR") : "-"}</td>
                    <td>{item.sentAt ? new Date(item.sentAt).toLocaleString("fr-FR") : item.nextAttemptAt ? `Retry ${new Date(item.nextAttemptAt).toLocaleString("fr-FR")}` : "-"}</td>
                    <td>{item.status !== "SENT" ? <button type="button" className="button-ghost" onClick={() => void markNotificationAsSent(item.id)}>Marquer envoyee</button> : null}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

