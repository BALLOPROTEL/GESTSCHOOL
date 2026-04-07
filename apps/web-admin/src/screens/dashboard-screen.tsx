import type {
  Enrollment,
  HeroSlide,
  Invoice,
  ModuleTile,
  ParentChild,
  ParentOverview,
  PortalNotification,
  RecoveryDashboard,
  ReportCard,
  Role,
  ScreenId,
  Student,
  TeacherClass,
  TeacherOverview
} from "../app-types";
import type { MosqueDashboard } from "../app-types";
import { ModuleIcon } from "../components/module-icon";

type DashboardScreenProps = {
  currentRole: Role | null;
  currentSlide: HeroSlide;
  defaultActionScreen: ScreenId;
  filteredTiles: ModuleTile[];
  invoices: Invoice[];
  classesCount: number;
  reportCards: ReportCard[];
  recovery: RecoveryDashboard | null;
  students: Student[];
  enrollments: Enrollment[];
  mosqueDashboard: MosqueDashboard | null;
  parentOverview: ParentOverview | null;
  parentChildren: ParentChild[];
  parentInvoices: Array<{ status: string }>;
  parentNotifications: PortalNotification[];
  teacherOverview: TeacherOverview | null;
  teacherClasses: TeacherClass[];
  teacherStudentsCount: number;
  teacherGradesCount: number;
  teacherNotifications: PortalNotification[];
  moduleQuery: string;
  mobileTasksOpen: boolean;
  onClearModuleFilter: () => void;
  onSelectScreen: (screen: ScreenId) => void;
  onToggleMobileTasks: () => void;
  formatMoney: (value: number, currency?: string) => string;
  hasScreenAccess: (role: Role, screen: ScreenId) => boolean;
  currentRoleLabel: string;
};

export function DashboardScreen(props: DashboardScreenProps): JSX.Element {
  const {
    classesCount,
    currentRole,
    currentRoleLabel,
    currentSlide,
    defaultActionScreen,
    enrollments,
    filteredTiles,
    formatMoney,
    hasScreenAccess,
    invoices,
    mobileTasksOpen,
    moduleQuery,
    mosqueDashboard,
    onClearModuleFilter,
    onSelectScreen,
    onToggleMobileTasks,
    parentChildren,
    parentInvoices,
    parentNotifications,
    parentOverview,
    recovery,
    reportCards,
    students,
    teacherClasses,
    teacherGradesCount,
    teacherNotifications,
    teacherOverview,
    teacherStudentsCount
  } = props;

  if (!currentRole) {
    return <></>;
  }

  const activeModules = filteredTiles.slice(0, 8);
  const primaryModule = filteredTiles[0];
  const openInvoices = invoices.filter((item) => item.status !== "PAID").length;
  const pendingReports = Math.max(0, classesCount - reportCards.length);
  const lowRecovery = (recovery?.totals.recoveryRatePercent ?? 0) < 70;
  let heroEyebrow = "Accueil simplifie";
  let heroTitle = "Tableau de bord clair et actionnable";
  let heroText = currentSlide.quote;
  let primaryActionScreen: ScreenId = primaryModule?.screen || defaultActionScreen;
  let primaryActionLabel = primaryModule
    ? `Ouvrir ${primaryModule.title}`
    : "Ouvrir l'espace principal";
  const priorityTitle = currentRole === "PARENT" ? "Actions utiles" : "Taches prioritaires";

  let dashboardCards: Array<{ label: string; value: string | number; hint: string }> = [];
  let dashboardTasks: Array<{ id: string; title: string; text: string; screen: ScreenId }> = [];
  let dashboardNotifications: Array<{
    id: string;
    tone: "warning" | "info";
    title: string;
    text: string;
  }> = [];

  if (currentRole === "PARENT") {
    heroEyebrow = "Espace parent";
    heroTitle = "Suivi famille strictement limite a vos enfants";
    heroText =
      "Accedez uniquement aux absences, bulletins, emplois du temps et paiements qui concernent votre famille.";
    primaryActionScreen = "parentPortal";
    primaryActionLabel = "Ouvrir le portail parent";
    dashboardCards = [
      {
        label: "Enfants",
        value: parentOverview?.childrenCount ?? parentChildren.length,
        hint: "Suivi famille"
      },
      {
        label: "Factures ouvertes",
        value:
          parentOverview?.openInvoicesCount ??
          parentInvoices.filter((item) => item.status !== "PAID").length,
        hint: "A regler"
      },
      {
        label: "Reste a payer",
        value: formatMoney(parentOverview?.remainingAmount ?? 0),
        hint: "Situation famille"
      },
      {
        label: "Notifications",
        value: parentOverview?.notificationsCount ?? parentNotifications.length,
        hint: "Messages recus"
      }
    ];
    dashboardTasks = [
      {
        id: "parent-portal",
        title: "Ouvrir le portail parent",
        text: "Retrouver les notes, absences et bulletins de vos enfants.",
        screen: "parentPortal"
      },
      {
        id: "family-payments",
        title: "Verifier les paiements",
        text: "Consulter les factures ouvertes et les reglements deja recus.",
        screen: "parentPortal"
      },
      {
        id: "family-timetable",
        title: "Consulter l'emploi du temps",
        text: "Voir les horaires utiles directement depuis l'espace famille.",
        screen: "parentPortal"
      }
    ];
    dashboardNotifications = [
      (parentOverview?.remainingAmount ?? 0) > 0
        ? {
            id: "parent-remaining",
            tone: "warning",
            title: "Paiements a suivre",
            text: `Reste a payer: ${formatMoney(parentOverview?.remainingAmount ?? 0)}`
          }
        : null,
      parentNotifications[0]
        ? {
            id: `parent-notification-${parentNotifications[0].id}`,
            tone: "info",
            title: parentNotifications[0].title,
            text: parentNotifications[0].message
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
      } => item !== null
    );
  } else if (currentRole === "ENSEIGNANT") {
    heroEyebrow = "Espace enseignant";
    heroTitle = "Vue enseignant limitee a vos classes";
    heroText =
      "Retrouvez vos classes, vos notes, votre emploi du temps et les notifications utiles a votre mission.";
    primaryActionScreen = "teacherPortal";
    primaryActionLabel = "Ouvrir le portail enseignant";
    dashboardCards = [
      {
        label: "Classes",
        value: teacherOverview?.classesCount ?? teacherClasses.length,
        hint: "Affectations"
      },
      {
        label: "Eleves suivis",
        value: teacherOverview?.studentsCount ?? teacherStudentsCount,
        hint: "Perimetre"
      },
      {
        label: "Notes",
        value: teacherOverview?.gradesCount ?? teacherGradesCount,
        hint: "Saisies"
      },
      {
        label: "Notifications",
        value: teacherOverview?.notificationsCount ?? teacherNotifications.length,
        hint: "Messages utiles"
      }
    ];
    dashboardTasks = [
      {
        id: "teacher-portal",
        title: "Ouvrir le portail enseignant",
        text: "Acceder aux classes, eleves et notes sous votre responsabilite.",
        screen: "teacherPortal"
      },
      {
        id: "teacher-grades",
        title: "Saisir les notes",
        text: "Renseigner les evaluations de vos classes affectees.",
        screen: "teacherPortal"
      },
      {
        id: "teacher-timetable",
        title: "Consulter l'emploi du temps",
        text: "Verifier rapidement vos creneaux hebdomadaires.",
        screen: "teacherPortal"
      }
    ];
    dashboardNotifications = [
      (teacherOverview?.pendingJustifications ?? 0) > 0
        ? {
            id: "teacher-justifications",
            tone: "warning",
            title: "Justificatifs en attente",
            text: `${teacherOverview?.pendingJustifications ?? 0} justificatif(s) restent a suivre.`
          }
        : null,
      teacherNotifications[0]
        ? {
            id: `teacher-notification-${teacherNotifications[0].id}`,
            tone: "info",
            title: teacherNotifications[0].title,
            text: teacherNotifications[0].message
          }
        : null,
      teacherNotifications[1]
        ? {
            id: `teacher-notification-${teacherNotifications[1].id}`,
            tone: "info",
            title: teacherNotifications[1].title,
            text: teacherNotifications[1].message
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
      } => item !== null
    );
  } else {
    const backOfficeCards: Array<{ label: string; value: string | number; hint: string } | null> = [
      hasScreenAccess(currentRole, "students")
        ? { label: "Eleves", value: students.length, hint: "Population" }
        : null,
      hasScreenAccess(currentRole, "reference") || hasScreenAccess(currentRole, "enrollments")
        ? { label: "Classes", value: classesCount, hint: "Organisation" }
        : null,
      hasScreenAccess(currentRole, "enrollments")
        ? { label: "Inscriptions", value: enrollments.length, hint: "Actives" }
        : null,
      hasScreenAccess(currentRole, "finance")
        ? {
            label: "Recouvrement",
            value: `${recovery ? recovery.totals.recoveryRatePercent.toFixed(1) : "0.0"}%`,
            hint: "Sante financiere"
          }
        : null,
      hasScreenAccess(currentRole, "grades")
        ? { label: "Bulletins", value: reportCards.length, hint: "Publies" }
        : null,
      hasScreenAccess(currentRole, "mosque")
        ? {
            label: "Dons mosquee",
            value: formatMoney(mosqueDashboard?.totals.donationsTotal ?? 0),
            hint: "Total cumule"
          }
        : null
    ];
    dashboardCards = backOfficeCards.filter(
      (item): item is { label: string; value: string | number; hint: string } => item !== null
    );

    dashboardTasks = [
      hasScreenAccess(currentRole, "students")
        ? {
            id: "students",
            title: "Creer un eleve",
            text: "Commencer un nouveau dossier eleve.",
            screen: "students" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "enrollments")
        ? {
            id: "enrollments",
            title: "Valider les inscriptions",
            text: "Relier eleves, classes et annee scolaire.",
            screen: "enrollments" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "finance")
        ? {
            id: "finance",
            title: "Suivre les paiements",
            text: "Verifier factures ouvertes et recouvrement.",
            screen: "finance" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "grades")
        ? {
            id: "grades",
            title: "Publier les bulletins",
            text: "Generer les bulletins PDF de periode.",
            screen: "grades" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "reports")
        ? {
            id: "reports",
            title: "Consulter les rapports",
            text: "Suivre les indicateurs et les journaux de conformite.",
            screen: "reports" as ScreenId
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        title: string;
        text: string;
        screen: ScreenId;
      } => item !== null
    );

    dashboardNotifications = [
      hasScreenAccess(currentRole, "finance") && lowRecovery
        ? {
            id: "recovery",
            tone: "warning",
            title: "Recouvrement a surveiller",
            text: `Taux actuel: ${(recovery?.totals.recoveryRatePercent ?? 0).toFixed(1)}%`
          }
        : null,
      hasScreenAccess(currentRole, "finance") && openInvoices > 0
        ? {
            id: "invoices",
            tone: "info",
            title: "Factures en attente",
            text: `${openInvoices} facture(s) restent a suivre.`
          }
        : null,
      hasScreenAccess(currentRole, "grades") && pendingReports > 0
        ? {
            id: "reports",
            tone: "info",
            title: "Bulletins a publier",
            text: `${pendingReports} classe(s) sans bulletin genere.`
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
      } => item !== null
    );
  }

  return (
    <>
      <section className="panel dashboard-hero">
        <div>
          <p className="eyebrow">
            {currentRole === "PARENT" || currentRole === "ENSEIGNANT"
              ? heroEyebrow
              : `${heroEyebrow} · ${currentRoleLabel}`}
          </p>
          <h2>{heroTitle}</h2>
          <p className="subtle">{heroText}</p>
        </div>
        <button
          type="button"
          className="hero-primary-cta"
          onClick={() => onSelectScreen(primaryActionScreen)}
        >
          {primaryActionLabel}
        </button>
      </section>

      <section className="dashboard-kpi-grid">
        {dashboardCards.slice(0, 4).map((card) => (
          <article key={card.label} className="panel metric-card kpi-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small className="subtle">{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <article className="panel dashboard-modules" aria-label="Modules applicatifs">
          <div className="table-header">
            <h2>Modules</h2>
            {moduleQuery.trim() ? (
              <button type="button" className="button-ghost" onClick={onClearModuleFilter}>
                Effacer filtre
              </button>
            ) : null}
          </div>
          <div className="module-grid">
            {activeModules.length === 0 ? (
              <article className="empty-modules">
                <h3>Aucun module trouve</h3>
                <p className="subtle">Essaie un mot-cle plus simple.</p>
              </article>
            ) : (
              activeModules.map((tile) => (
                <button
                  key={tile.screen}
                  type="button"
                  className="module-card"
                  onClick={() => onSelectScreen(tile.screen)}
                >
                  <span className={`module-icon tone-${tile.tone}`}>
                    <ModuleIcon name={tile.icon} />
                  </span>
                  <span className="module-text">
                    <strong>{tile.title}</strong>
                    <small>{tile.subtitle}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </article>

        <aside className="dashboard-side">
          <article className="panel priority-panel">
            <div className="priority-panel-head">
              <div className="table-header">
                <h3>{priorityTitle}</h3>
              </div>
              <button
                type="button"
                className="mobile-section-toggle"
                aria-expanded={mobileTasksOpen}
                onClick={onToggleMobileTasks}
              >
                {mobileTasksOpen ? "Masquer" : "Afficher"}
              </button>
            </div>
            <div className={`priority-collapsible ${mobileTasksOpen ? "is-open" : ""}`.trim()}>
              <div className="priority-list">
                {dashboardTasks.length === 0 ? (
                  <p className="subtle">Aucune action prioritaire pour ce profil.</p>
                ) : (
                  dashboardTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="priority-item"
                      onClick={() => onSelectScreen(task.screen)}
                    >
                      <strong>{task.title}</strong>
                      <small>{task.text}</small>
                    </button>
                  ))
                )}
              </div>
            </div>
          </article>

          <article className="panel priority-panel">
            <div className="table-header">
              <h3>
                {currentRole === "PARENT" ? "Informations recentes" : "Notifications recentes"}
              </h3>
            </div>
            <div className="notice-list">
              {dashboardNotifications.length === 0 ? (
                <p className="subtle">
                  {currentRole === "PARENT"
                    ? "Aucune information sensible ou urgente a signaler."
                    : "Aucune alerte critique pour le moment."}
                </p>
              ) : (
                dashboardNotifications.map((item) => (
                  <article key={item.id} className={`notice-card notice-${item.tone}`}>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </article>
                ))
              )}
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
