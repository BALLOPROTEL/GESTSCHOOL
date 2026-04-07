import { RefObject, useLayoutEffect } from "react";

export type UiLanguage = "fr" | "en" | "ar";

export type UiLanguageMeta = {
  label: string;
  locale: string;
  iconSrc: string;
  dir: "ltr" | "rtl";
};

export const UI_LANGUAGE_ORDER: UiLanguage[] = ["fr", "en", "ar"];

export const UI_LANGUAGE_META: Record<UiLanguage, UiLanguageMeta> = {
  fr: { label: "Francais", locale: "fr-FR", iconSrc: "/france.png", dir: "ltr" },
  en: { label: "Anglais", locale: "en-US", iconSrc: "/anglais.png", dir: "ltr" },
  ar: { label: "Arabe", locale: "ar", iconSrc: "/arabe.png", dir: "rtl" }
};

type TargetLanguage = Exclude<UiLanguage, "fr">;
type AttributeName = "placeholder" | "title" | "aria-label" | "alt";
type ExactTranslations = Record<TargetLanguage, Record<string, string>>;
type PatternTranslation = {
  pattern: RegExp;
  translate: (match: RegExpExecArray, translate: (value: string) => string) => string;
};

const TRANSLATABLE_ATTRIBUTES: AttributeName[] = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);

const textSourceMap = new WeakMap<Text, string>();
const attributeSourceMap = new WeakMap<Element, Map<AttributeName, string>>();

const EXACT_TRANSLATIONS: ExactTranslations = {
  en: {
    Francais: "French",
    Anglais: "English",
    Arabe: "Arabic",
    Connexion: "Sign in",
    "Email ou identifiant": "Email or username",
    "Email ou Identifiant": "Email or Username",
    "Mot de passe": "Password",
    "Mot de Passe": "Password",
    "Connectez-vous a votre compte": "Sign in to your account",
    "Se souvenir de moi": "Remember me",
    "Mot de passe oublie?": "Forgot password?",
    "Afficher le mot de passe": "Show password",
    "Masquer le mot de passe": "Hide password",
    "Selectionner la langue": "Select language",
    "Acces centralise pour administrer les eleves, les enseignants et les parents d'eleves.":
      "Centralized access to manage students, teachers, and parents.",
    "Se Connecter": "Sign In",
    "Connexion...": "Signing in...",
    "Premiere connexion ? Masquer": "First login? Hide",
    "Premiere connexion ? Activer": "First login? Activate",
    "Premiere connexion ?": "First login?",
    Masquer: "Hide",
    Activer: "Activate",
    "Activer mon compte": "Activate my account",
    "Retour connexion": "Back to sign in",
    "Recuperez l'acces a votre compte": "Recover access to your account",
    "Recevoir les instructions": "Receive instructions",
    "Entrez votre identifiant pour demander un code de reinitialisation.":
      "Enter your username to request a reset code.",
    "Saisissez le code recu et choisissez un nouveau mot de passe securise.":
      "Enter the received code and choose a secure new password.",
    "Finalisez votre premiere connexion avec le mot de passe temporaire recu.":
      "Complete your first sign-in using the temporary password you received.",
    "Reinitialisation du mot de passe": "Password reset",
    Identifiant: "Username",
    "Envoyer les instructions": "Send instructions",
    "Code de reinitialisation": "Reset code",
    "Nouveau mot de passe": "New password",
    Confirmation: "Confirmation",
    "Valider la reinitialisation": "Confirm reset",
    "Activation premiere connexion": "First login activation",
    "Mot de passe temporaire": "Temporary password",
    "Activer le compte": "Activate account",
    "Envoi...": "Sending...",
    "Validation...": "Validating...",
    "Activation...": "Activating...",
    "Changement de theme en cours": "Theme switch in progress",
    "Changement de langue en cours": "Language switch in progress",
    "Mode sombre": "Dark mode",
    "Mode clair": "Light mode",
    "Connexion securisee - GestSchool 2026": "Secure sign-in - GestSchool 2026",
    "Fermer le menu": "Close menu",
    "Menu rapide": "Quick menu",
    "Recherche rapide...": "Quick search...",
    MENU: "MENU",
    Principal: "Main",
    "Vie scolaire": "School life",
    Navigation: "Navigation",
    Modules: "Modules",
    "Modules applicatifs": "Application modules",
    "Se deconnecter": "Sign out",
    Session: "Session",
    "Non synchronise": "Not synced",
    "Annee:": "Year:",
    "Derniere sync:": "Last sync:",
    "Actifs:": "Active:",
    Fermer: "Close",
    Attention: "Warning",
    Information: "Information",
    "Tableau de bord": "Dashboard",
    "Utilisateurs & droits": "Users & permissions",
    Eleves: "Students",
    Referentiel: "Reference",
    Inscriptions: "Enrollments",
    Comptabilite: "Accounting",
    "Rapports & conformite": "Reports & compliance",
    Mosquee: "Mosque",
    "Notes & bulletins": "Grades & report cards",
    Pilotage: "Overview",
    Absences: "Attendance",
    "Emploi du temps": "Timetable",
    Notifications: "Notifications",
    "Portail enseignant": "Teacher portal",
    "Portail parent": "Parent portal",
    Administration: "Administration",
    Scolarite: "School office",
    "Espace enseignant": "Teacher space",
    "Espace comptable": "Accounting space",
    "Espace parent": "Parent space",
    Administrateur: "Administrator",
    Enseignant: "Teacher",
    Comptable: "Accountant",
    Parent: "Parent",
    Ouverte: "Open",
    "Partiellement reglee": "Partially paid",
    Soldee: "Paid",
    Annulee: "Cancelled",
    Present: "Present",
    Absent: "Absent",
    Retard: "Late",
    Excuse: "Excused",
    "En attente": "Pending",
    Validee: "Validated",
    Rejetee: "Rejected",
    Planifiee: "Scheduled",
    Envoyee: "Sent",
    Echec: "Failed",
    Livree: "Delivered",
    Transmise: "Forwarded",
    "Nouvelle tentative": "Retry",
    "Non distribuable": "Undeliverable",
    Parents: "Parents",
    Enseignants: "Teachers",
    Actif: "Active",
    Inactif: "Inactive",
    Inscrit: "Enrolled",
    Finalisee: "Completed",
    Lundi: "Monday",
    Mardi: "Tuesday",
    Mercredi: "Wednesday",
    Jeudi: "Thursday",
    Vendredi: "Friday",
    Samedi: "Saturday",
    Dimanche: "Sunday",
    Lecture: "Read",
    Creation: "Create",
    Modification: "Update",
    Suppression: "Delete",
    Validation: "Validation",
    Envoi: "Send",
    Utilisateurs: "Users",
    Finance: "Finance",
    Paiements: "Payments",
    Notes: "Grades",
    Bulletins: "Report cards",
    Justificatifs: "Supporting documents",
    "Validation absences": "Attendance validation",
    Analytique: "Analytics",
    Audit: "Audit",
    "Comptes, roles et permissions": "Accounts, roles and permissions",
    "Dossiers et profils": "Files and profiles",
    "Affectation classe/annee": "Class/year assignment",
    "Pilotage quotidien": "Daily overview",
    "Pointage et justificatifs": "Attendance and supporting documents",
    "Planning hebdomadaire": "Weekly schedule",
    Communication: "Communication",
    "Notifications multi-canal": "Multi-channel notifications",
    "Factures, paiements, recouvrement": "Invoices, payments, collections",
    "Indicateurs executifs et journal d'audit": "Executive KPIs and audit log",
    "Membres, activites et dons": "Members, activities and donations",
    "Evaluations et bulletins PDF": "Assessments and PDF report cards",
    Parametres: "Settings",
    "Referentiel academique": "Academic reference",
    "Espace pedagogique": "Teaching workspace",
    "Suivi famille": "Family follow-up",
    Citation: "Quote",
    Annonce: "Announcement",
    Vision: "Vision",
    "Ouvrez des ecoles, vous fermerez des prisons.": "Open schools and you will close prisons.",
    "Bienvenue sur GestSchool: suivi unifie de la vie academique et financiere.":
      "Welcome to GestSchool: unified academic and financial follow-up.",
    "Un ecran clair, des workflows simples, une equipe plus efficace.":
      "A clear screen, simpler workflows, a more efficient team.",
    "Equipe Produit": "Product team",
    "Annonce Systeme": "System announcement",
    "Renseigner votre identifiant pour demander un token de reinitialisation.":
      "Enter your username to request a reset token.",
    "Demande de reinitialisation enregistree.": "Reset request recorded.",
    "Connexion API impossible pendant la demande de reinitialisation.":
      "Unable to reach the API during the reset request.",
    "Token de reinitialisation requis.": "Reset token required.",
    "La confirmation du mot de passe ne correspond pas.": "Password confirmation does not match.",
    "Mot de passe reinitialise.": "Password reset.",
    "Connexion API impossible pendant la reinitialisation du mot de passe.":
      "Unable to reach the API during password reset.",
    "Identifiant requis.": "Username required.",
    "Mot de passe temporaire invalide.": "Invalid temporary password.",
    "Premiere connexion finalisee.": "First login completed.",
    "Connexion API impossible pendant l'activation du compte.":
      "Unable to reach the API during account activation.",
    "Connexion reussie.": "Signed in successfully.",
    "Connexion API impossible. En local, verifie que l'API Nest tourne sur le port 3000.":
      "Unable to reach the API. Locally, make sure the Nest API is running on port 3000.",
    "Deconnexion reussie.": "Signed out successfully.",
    "Session expiree.": "Session expired.",
    "Session actualisee.": "Session refreshed.",
    "API indisponible ou CORS refuse. Verifie CORS_ORIGINS sur Render.":
      "API unavailable or CORS rejected. Check CORS_ORIGINS on Render.",
    "Utilisateur mis a jour.": "User updated.",
    "Utilisateur cree.": "User created.",
    "Utilisateur supprime.": "User deleted.",
    "Affectation enseignant creee.": "Teacher assignment created.",
    "Affectation enseignant supprimee.": "Teacher assignment deleted.",
    "Lien parent-eleve cree.": "Parent-student link created.",
    "Lien parent-eleve supprime.": "Parent-student link deleted.",
    "Note enregistree.": "Grade saved.",
    "Pointage enregistre.": "Attendance saved.",
    "Notification parent envoyee.": "Parent notification sent.",
    "Élève modifié.": "Student updated.",
    "Élève ajouté.": "Student added.",
    "Élève supprimé.": "Student deleted.",
    "Membre mosquee cree.": "Mosque member created.",
    "Membre mosquee supprime.": "Mosque member deleted.",
    "Activite mosquee creee.": "Mosque activity created.",
    "Activite mosquee supprimee.": "Mosque activity deleted.",
    "Don enregistre.": "Donation saved.",
    "Don supprime.": "Donation deleted.",
    "Inscription créée.": "Enrollment created.",
    "Inscription supprimée.": "Enrollment deleted.",
    "Plan tarifaire cree.": "Fee plan created.",
    "Plan tarifaire supprime.": "Fee plan deleted.",
    "Facture creee.": "Invoice created.",
    "Facture supprimee.": "Invoice deleted.",
    "Paiement enregistre.": "Payment saved.",
    "La periode filtree doit appartenir a la meme annee scolaire que la classe.":
      "The filtered period must belong to the same school year as the class.",
    "Selectionne d'abord une classe et une periode.": "Select a class and a period first.",
    "La periode doit appartenir a la meme annee scolaire que la classe selectionnee.":
      "The period must belong to the same school year as the selected class.",
    "Synthese de classe calculee.": "Class summary generated.",
    "Bulletin genere.": "Report card generated.",
    "Absence enregistree.": "Attendance recorded.",
    "Absence supprimee.": "Attendance deleted.",
    "Action non autorisee en mode lecture seule.": "Action not allowed in read-only mode.",
    "Selectionner une ligne d'absence pour ajouter un justificatif.":
      "Select an attendance row to add a supporting document.",
    "Renseigner le nom du fichier et son URL.": "Provide the file name and its URL.",
    "Justificatif ajoute.": "Supporting document added.",
    "Justificatif supprime.": "Supporting document deleted.",
    "Selectionner une ligne d'absence a valider.": "Select an attendance row to validate.",
    "Validation mise a jour.": "Validation updated.",
    "Selectionner au moins un eleve pour la saisie en masse.":
      "Select at least one student for bulk entry.",
    "Cours ajoute a l'emploi du temps.": "Class added to the timetable.",
    "Cours supprime.": "Class removed.",
    "Notification creee.": "Notification created.",
    "Notification marquee comme envoyee.": "Notification marked as sent.",
    "Pilotage vie scolaire": "School life overview",
    "Total pointages": "Total attendance entries",
    Presences: "Present",
    Retards: "Late arrivals",
    Excuses: "Excused",
    "Taux absence+retard": "Absence + late rate",
    "Aucun cumul d'absences notable sur la periode.": "No notable absence accumulation during the period.",
    "Saisissez un pointage individuel clair, lisible et rapidement exploitable.":
      "Record individual attendance clearly and keep it easy to review.",
    "Absences - saisie de masse": "Attendance - bulk entry",
    "Traitez une classe complete sans perdre la lisibilite du journal des absences.":
      "Process a full class without losing the readability of the attendance log.",
    Classe: "Class",
    Date: "Date",
    Statut: "Status",
    "Motif global": "Shared reason",
    "Ctrl/Cmd + clic pour multi-selection.": "Ctrl/Cmd + click for multi-selection.",
    "Enregistrer en masse": "Save in bulk",
    "Journal des absences": "Attendance log",
    "Filtre rapide, puis actions sur chaque ligne.": "Quick filters, then actions on each row.",
    Eleve: "Student",
    Du: "From",
    Au: "To",
    Actions: "Actions",
    Justif: "Docs",
    Pieces: "Files",
    Motif: "Reason",
    "Aucune ligne.": "No entries.",
    Supprimer: "Delete",
    "Justificatifs & validation": "Supporting documents & validation",
    "Centralisez validation et pieces justificatives sans ouvrir plusieurs ecrans.":
      "Centralize validation and supporting documents without opening multiple screens.",
    "Pointage cible": "Target attendance",
    "Statut justification": "Justification status",
    "Commentaire validation": "Validation comment",
    "Enregistrer validation": "Save validation",
    "Ajout de justificatif": "Add supporting document",
    "Nom du fichier": "File name",
    "URL du justificatif": "Supporting document URL",
    "MIME type": "MIME type",
    "Ajouter justificatif": "Add supporting document",
    "Liste des justificatifs": "Supporting document list",
    Fichier: "File",
    MIME: "MIME",
    "Ajoute le": "Added on",
    "Selectionner une absence.": "Select an absence.",
    "Aucun justificatif.": "No supporting document.",
    "Composez des creneaux lisibles puis controlez la semaine complete en un seul coup d'oeil.":
      "Build clear slots and review the full week at a glance.",
    Matiere: "Subject",
    Jour: "Day",
    Debut: "Start",
    Fin: "End",
    Salle: "Room",
    Ajouter: "Add",
    "Grille d'emploi du temps": "Timetable grid",
    "Recherche par classe et par jour.": "Search by class and day.",
    Heure: "Time",
    "Aucun cours.": "No classes.",
    "Vue hebdo": "Weekly view",
    "Aucun cours": "No class",
    "Envoyer les notifications en attente": "Send pending notifications",
    "Programmez les messages importants avec un flux plus propre pour les equipes.":
      "Schedule important messages with a cleaner workflow for teams.",
    Titre: "Title",
    Message: "Message",
    Audience: "Audience",
    Canal: "Channel",
    "Cible explicite": "Explicit target",
    "Programmer l'envoi": "Schedule sending",
    "Historique notifications": "Notification history",
    "Suivi des envois, statuts et relances.": "Track sends, statuses and retries.",
    Distribution: "Delivery",
    Cible: "Target",
    Fournisseur: "Provider",
    Tentatives: "Attempts",
    "Aucune notification.": "No notifications.",
    "Marquer comme envoyee": "Mark as sent",
    Application: "App",
    "E-mail": "Email",
    "En file": "Queued",
    Filtrer: "Filter",
    Reinitialiser: "Reset",
    "Choisir...": "Choose...",
    Tous: "All",
    Toutes: "All",
    Aucun: "None",
    "Filtrer par matricule, nom ou prenom": "Filter by ID, last name or first name",
    "Total du": "Total due",
    "Montant encaisse": "Collected amount",
    "Reste a recouvrer": "Outstanding amount",
    "Taux recouvrement": "Collection rate",
    Libelle: "Label",
    Annee: "Year",
    Niveau: "Level",
    Total: "Total",
    Numero: "Number",
    Paye: "Paid",
    Reste: "Remaining",
    Recu: "Receipt",
    Montant: "Amount",
    Mode: "Method",
    Code: "Code",
    Contact: "Contact",
    Adhesion: "Join date",
    Categorie: "Category",
    Lieu: "Location",
    Transactions: "Transactions",
    Periode: "Period",
    Evaluation: "Assessment",
    Type: "Type",
    Note: "Score",
    Moyenne: "Average",
    Rang: "Rank",
    Appreciation: "Comment",
    Utilisateur: "User",
    Ressource: "Resource",
    "ID Ressource": "Resource ID",
    Payload: "Payload",
    "Aucune donnee.": "No data.",
    "Aucun membre.": "No members.",
    "Aucune activite.": "No activities.",
    "Aucun don.": "No donations.",
    "Aucun resume calcule pour l'instant.": "No summary calculated yet.",
    "Actualiser KPI": "Refresh KPIs",
    "Eleves actifs": "Active students",
    "Inscriptions actives": "Active enrollments",
    Recouvrement: "Collection",
    "Dons mosquee": "Mosque donations",
    "Alertes notifications": "Notification alerts",
    "Journal de conformite": "Compliance log",
    "Livrables d'export": "Export outputs",
    "Fermer la notification d'erreur": "Close error notification",
    "Fermer la notification": "Close notification",
    "Liste des eleves": "Student list",
    "Synthese du recouvrement": "Collection summary",
    "Suivez la sante financiere avant de passer aux operations de saisie.":
      "Track financial health before moving to entry operations.",
    "Plans de frais": "Fee plans",
    "Definissez les frais par annee et niveau, puis reutilisez-les pour la facturation.":
      "Define fees by year and level, then reuse them for invoicing.",
    "Creer le plan de frais": "Create fee plan",
    "Liste des plans de frais": "Fee plan list",
    Factures: "Invoices",
    "Associez un eleve, une annee et un montant du pour generer une facture claire.":
      "Assign a student, a year and an amount due to generate a clear invoice.",
    "Creer facture": "Create invoice",
    "Liste factures": "Invoice list",
    "Enregistrez chaque encaissement et rattachez-le a la facture correspondante.":
      "Record each payment and link it to the matching invoice.",
    "Enregistrer paiement": "Record payment",
    "Historique paiements": "Payment history",
    "Registre des membres": "Member registry",
    "Activites mosquee": "Mosque activities",
    "Dons & recettes": "Donations & revenue",
    "Synthese du module mosquee": "Mosque module summary",
    "Filtres notes": "Grade filters",
    "Ciblez une classe, une matiere et une periode pour travailler sans surcharge.":
      "Target a class, a subject and a period to work without overload.",
    "Saisie note": "Grade entry",
    "Saisissez une evaluation a la fois avec validations inline.":
      "Enter one assessment at a time with inline validation.",
    "Enregistrer note": "Save grade",
    "Notes enregistrees": "Saved grades",
    "Moyennes et rangs": "Averages and ranks",
    "Generation bulletin PDF": "PDF report card generation",
    "Generez un bulletin par eleve/periode et ouvrez le PDF en un clic.":
      "Generate one report card per student/period and open the PDF in one click.",
    "Generer bulletin": "Generate report card",
    "Bulletins generes": "Generated report cards",
    "Filtrer la fenetre de pilotage": "Filter analytics window"
  },
  ar: {
    Francais: "الفرنسية",
    Anglais: "الإنجليزية",
    Arabe: "العربية",
    Connexion: "تسجيل الدخول",
    "Email ou identifiant": "البريد الإلكتروني أو اسم المستخدم",
    "Email ou Identifiant": "البريد الإلكتروني أو اسم المستخدم",
    "Mot de passe": "كلمة المرور",
    "Mot de Passe": "كلمة المرور",
    "Se souvenir de moi": "تذكرني",
    "Mot de passe oublie?": "هل نسيت كلمة المرور؟",
    "Se Connecter": "تسجيل الدخول",
    "Connexion...": "جارٍ تسجيل الدخول...",
    "Premiere connexion ? Masquer": "أول تسجيل دخول؟ إخفاء",
    "Premiere connexion ? Activer": "أول تسجيل دخول؟ تفعيل",
    "Premiere connexion ?": "أول تسجيل دخول؟",
    Masquer: "إخفاء",
    Activer: "تفعيل",
    "Reinitialisation du mot de passe": "إعادة تعيين كلمة المرور",
    Identifiant: "اسم المستخدم",
    "Envoyer les instructions": "إرسال التعليمات",
    "Code de reinitialisation": "رمز إعادة التعيين",
    "Nouveau mot de passe": "كلمة المرور الجديدة",
    Confirmation: "تأكيد",
    "Valider la reinitialisation": "تأكيد إعادة التعيين",
    "Activation premiere connexion": "تفعيل أول تسجيل دخول",
    "Mot de passe temporaire": "كلمة المرور المؤقتة",
    "Activer le compte": "تفعيل الحساب",
    "Envoi...": "جارٍ الإرسال...",
    "Validation...": "جارٍ التحقق...",
    "Activation...": "جارٍ التفعيل...",
    "Changement de theme en cours": "جارٍ تبديل السمة",
    "Changement de langue en cours": "جارٍ تبديل اللغة",
    "Mode sombre": "الوضع الداكن",
    "Mode clair": "الوضع الفاتح",
    "Fermer le menu": "إغلاق القائمة",
    "Menu rapide": "القائمة السريعة",
    "Recherche rapide...": "بحث سريع...",
    MENU: "القائمة",
    Principal: "الرئيسية",
    "Vie scolaire": "الحياة المدرسية",
    Navigation: "التنقل",
    Modules: "الوحدات",
    "Modules applicatifs": "وحدات التطبيق",
    "Se deconnecter": "تسجيل الخروج",
    Session: "الجلسة",
    "Non synchronise": "غير متزامن",
    "Annee:": "السنة:",
    "Derniere sync:": "آخر مزامنة:",
    "Actifs:": "النشطون:",
    Fermer: "إغلاق",
    Attention: "تنبيه",
    Information: "معلومة",
    "Tableau de bord": "لوحة التحكم",
    "Utilisateurs & droits": "المستخدمون والصلاحيات",
    Eleves: "الطلاب",
    Referentiel: "المرجع",
    Inscriptions: "التسجيلات",
    Comptabilite: "المحاسبة",
    "Rapports & conformite": "التقارير والامتثال",
    Mosquee: "المسجد",
    "Notes & bulletins": "الدرجات وكشوف النتائج",
    Pilotage: "المتابعة",
    Absences: "الغياب",
    "Emploi du temps": "الجدول الدراسي",
    Notifications: "الإشعارات",
    "Portail enseignant": "بوابة المعلم",
    "Portail parent": "بوابة ولي الأمر",
    Administration: "الإدارة",
    Scolarite: "شؤون الدراسة",
    "Espace enseignant": "مساحة المعلم",
    "Espace comptable": "مساحة المحاسبة",
    "Espace parent": "مساحة ولي الأمر",
    Administrateur: "المدير",
    Enseignant: "المعلم",
    Comptable: "المحاسب",
    Parent: "ولي الأمر",
    Ouverte: "مفتوحة",
    "Partiellement reglee": "مدفوعة جزئياً",
    Soldee: "مدفوعة",
    Annulee: "ملغاة",
    Present: "حاضر",
    Absent: "غائب",
    Retard: "متأخر",
    Excuse: "بعذر",
    "En attente": "قيد الانتظار",
    Validee: "تم الاعتماد",
    Rejetee: "مرفوضة",
    Planifiee: "مجدولة",
    Envoyee: "تم الإرسال",
    Echec: "فشل",
    Livree: "تم التسليم",
    Transmise: "تم التحويل",
    "Nouvelle tentative": "إعادة محاولة",
    "Non distribuable": "غير قابل للتسليم",
    Parents: "أولياء الأمور",
    Enseignants: "المعلمون",
    Actif: "نشط",
    Inactif: "غير نشط",
    Inscrit: "مسجل",
    Finalisee: "مكتملة",
    Lundi: "الاثنين",
    Mardi: "الثلاثاء",
    Mercredi: "الأربعاء",
    Jeudi: "الخميس",
    Vendredi: "الجمعة",
    Samedi: "السبت",
    Dimanche: "الأحد",
    Lecture: "قراءة",
    Creation: "إنشاء",
    Modification: "تعديل",
    Suppression: "حذف",
    Validation: "اعتماد",
    Envoi: "إرسال",
    Utilisateurs: "المستخدمون",
    Finance: "المالية",
    Paiements: "المدفوعات",
    Notes: "الدرجات",
    Bulletins: "كشوف النتائج",
    Justificatifs: "المرفقات",
    "Validation absences": "اعتماد الغياب",
    Analytique: "التحليلات",
    Audit: "التدقيق",
    "Comptes, roles et permissions": "الحسابات والأدوار والصلاحيات",
    "Dossiers et profils": "الملفات والبيانات",
    "Affectation classe/annee": "إسناد الصف/السنة",
    "Pilotage quotidien": "متابعة يومية",
    "Pointage et justificatifs": "التسجيل والمرفقات",
    "Planning hebdomadaire": "خطة أسبوعية",
    Communication: "التواصل",
    "Notifications multi-canal": "إشعارات متعددة القنوات",
    "Factures, paiements, recouvrement": "الفواتير والمدفوعات والتحصيل",
    "Indicateurs executifs et journal d'audit": "مؤشرات تنفيذية وسجل التدقيق",
    "Membres, activites et dons": "الأعضاء والأنشطة والتبرعات",
    "Evaluations et bulletins PDF": "التقييمات وكشوف PDF",
    Parametres: "الإعدادات",
    "Referentiel academique": "المرجع الأكاديمي",
    "Espace pedagogique": "المساحة التعليمية",
    "Suivi famille": "متابعة الأسرة",
    Citation: "اقتباس",
    Annonce: "إعلان",
    Vision: "رؤية",
    "Ouvrez des ecoles, vous fermerez des prisons.": "افتحوا المدارس تُغلقوا السجون.",
    "Bienvenue sur GestSchool: suivi unifie de la vie academique et financiere.":
      "مرحباً بكم في GestSchool: متابعة موحدة للحياة الأكاديمية والمالية.",
    "Un ecran clair, des workflows simples, une equipe plus efficace.":
      "واجهة واضحة، ومسارات عمل أبسط، وفريق أكثر كفاءة.",
    "Equipe Produit": "فريق المنتج",
    "Annonce Systeme": "إعلان النظام",
    "Renseigner votre identifiant pour demander un token de reinitialisation.":
      "أدخل اسم المستخدم لطلب رمز إعادة التعيين.",
    "Demande de reinitialisation enregistree.": "تم تسجيل طلب إعادة التعيين.",
    "Connexion API impossible pendant la demande de reinitialisation.":
      "تعذر الوصول إلى الواجهة البرمجية أثناء طلب إعادة التعيين.",
    "Token de reinitialisation requis.": "رمز إعادة التعيين مطلوب.",
    "La confirmation du mot de passe ne correspond pas.": "تأكيد كلمة المرور غير مطابق.",
    "Mot de passe reinitialise.": "تمت إعادة تعيين كلمة المرور.",
    "Connexion API impossible pendant la reinitialisation du mot de passe.":
      "تعذر الوصول إلى الواجهة البرمجية أثناء إعادة تعيين كلمة المرور.",
    "Identifiant requis.": "اسم المستخدم مطلوب.",
    "Mot de passe temporaire invalide.": "كلمة المرور المؤقتة غير صالحة.",
    "Premiere connexion finalisee.": "اكتمل أول تسجيل دخول.",
    "Connexion API impossible pendant l'activation du compte.":
      "تعذر الوصول إلى الواجهة البرمجية أثناء تفعيل الحساب.",
    "Connexion reussie.": "تم تسجيل الدخول بنجاح.",
    "Connexion API impossible. En local, verifie que l'API Nest tourne sur le port 3000.":
      "تعذر الوصول إلى الواجهة البرمجية. محلياً، تأكد من أن Nest API تعمل على المنفذ 3000.",
    "Deconnexion reussie.": "تم تسجيل الخروج بنجاح.",
    "Session expiree.": "انتهت الجلسة.",
    "Session actualisee.": "تم تحديث الجلسة.",
    "API indisponible ou CORS refuse. Verifie CORS_ORIGINS sur Render.":
      "الواجهة البرمجية غير متاحة أو تم رفض CORS. تحقق من CORS_ORIGINS على Render.",
    "Utilisateur mis a jour.": "تم تحديث المستخدم.",
    "Utilisateur cree.": "تم إنشاء المستخدم.",
    "Utilisateur supprime.": "تم حذف المستخدم.",
    "Affectation enseignant creee.": "تم إنشاء إسناد المعلم.",
    "Affectation enseignant supprimee.": "تم حذف إسناد المعلم.",
    "Lien parent-eleve cree.": "تم إنشاء ربط ولي الأمر بالطالب.",
    "Lien parent-eleve supprime.": "تم حذف ربط ولي الأمر بالطالب.",
    "Note enregistree.": "تم حفظ الدرجة.",
    "Pointage enregistre.": "تم حفظ الحضور.",
    "Notification parent envoyee.": "تم إرسال إشعار ولي الأمر.",
    "Élève modifié.": "تم تعديل الطالب.",
    "Élève ajouté.": "تمت إضافة الطالب.",
    "Élève supprimé.": "تم حذف الطالب.",
    "Membre mosquee cree.": "تم إنشاء عضو في المسجد.",
    "Membre mosquee supprime.": "تم حذف عضو المسجد.",
    "Activite mosquee creee.": "تم إنشاء نشاط المسجد.",
    "Activite mosquee supprimee.": "تم حذف نشاط المسجد.",
    "Don enregistre.": "تم حفظ التبرع.",
    "Don supprime.": "تم حذف التبرع.",
    "Inscription créée.": "تم إنشاء التسجيل.",
    "Inscription supprimée.": "تم حذف التسجيل.",
    "Plan tarifaire cree.": "تم إنشاء الخطة المالية.",
    "Plan tarifaire supprime.": "تم حذف الخطة المالية.",
    "Facture creee.": "تم إنشاء الفاتورة.",
    "Facture supprimee.": "تم حذف الفاتورة.",
    "Paiement enregistre.": "تم حفظ الدفع.",
    "La periode filtree doit appartenir a la meme annee scolaire que la classe.":
      "يجب أن تنتمي الفترة المفلترة إلى نفس السنة الدراسية الخاصة بالصف.",
    "Selectionne d'abord une classe et une periode.": "اختر أولاً صفاً وفترة.",
    "La periode doit appartenir a la meme annee scolaire que la classe selectionnee.":
      "يجب أن تنتمي الفترة إلى نفس السنة الدراسية للصف المحدد.",
    "Synthese de classe calculee.": "تم احتساب ملخص الصف.",
    "Bulletin genere.": "تم إنشاء كشف النتائج.",
    "Absence enregistree.": "تم تسجيل الحضور/الغياب.",
    "Absence supprimee.": "تم حذف السجل.",
    "Action non autorisee en mode lecture seule.": "الإجراء غير مسموح به في وضع القراءة فقط.",
    "Selectionner une ligne d'absence pour ajouter un justificatif.":
      "اختر سطراً من الغياب لإضافة مرفق.",
    "Renseigner le nom du fichier et son URL.": "أدخل اسم الملف ورابطه.",
    "Justificatif ajoute.": "تمت إضافة المرفق.",
    "Justificatif supprime.": "تم حذف المرفق.",
    "Selectionner une ligne d'absence a valider.": "اختر سطراً من الغياب لاعتماده.",
    "Validation mise a jour.": "تم تحديث الاعتماد.",
    "Selectionner au moins un eleve pour la saisie en masse.":
      "اختر طالباً واحداً على الأقل للإدخال الجماعي.",
    "Cours ajoute a l'emploi du temps.": "تمت إضافة الحصة إلى الجدول.",
    "Cours supprime.": "تم حذف الحصة.",
    "Notification creee.": "تم إنشاء الإشعار.",
    "Notification marquee comme envoyee.": "تم وضع الإشعار كمرسل.",
    "Pilotage vie scolaire": "متابعة الحياة المدرسية",
    "Total pointages": "إجمالي السجلات",
    Presences: "الحضور",
    Retards: "التأخيرات",
    Excuses: "الأعذار",
    "Taux absence+retard": "نسبة الغياب + التأخير",
    "Aucun cumul d'absences notable sur la periode.": "لا يوجد تراكم ملحوظ للغياب خلال الفترة.",
    "Saisissez un pointage individuel clair, lisible et rapidement exploitable.":
      "سجل حضوراً فردياً واضحاً وسهل المراجعة.",
    "Absences - saisie de masse": "الغياب - إدخال جماعي",
    "Traitez une classe complete sans perdre la lisibilite du journal des absences.":
      "عالج صفاً كاملاً مع الحفاظ على وضوح سجل الغياب.",
    Classe: "الصف",
    Date: "التاريخ",
    Statut: "الحالة",
    "Motif global": "سبب عام",
    "Ctrl/Cmd + clic pour multi-selection.": "Ctrl/Cmd + نقر للاختيار المتعدد.",
    "Enregistrer en masse": "حفظ جماعي",
    "Journal des absences": "سجل الغياب",
    "Filtre rapide, puis actions sur chaque ligne.": "ترشيح سريع ثم إجراءات لكل سطر.",
    Eleve: "الطالب",
    Du: "من",
    Au: "إلى",
    Actions: "الإجراءات",
    Justif: "المرفقات",
    Pieces: "الملفات",
    Motif: "السبب",
    "Aucune ligne.": "لا توجد سطور.",
    Supprimer: "حذف",
    "Justificatifs & validation": "المرفقات والاعتماد",
    "Centralisez validation et pieces justificatives sans ouvrir plusieurs ecrans.":
      "اجمع الاعتماد والمرفقات دون فتح عدة شاشات.",
    "Pointage cible": "السجل المستهدف",
    "Statut justification": "حالة التبرير",
    "Commentaire validation": "تعليق الاعتماد",
    "Enregistrer validation": "حفظ الاعتماد",
    "Ajout de justificatif": "إضافة مرفق",
    "Nom du fichier": "اسم الملف",
    "URL du justificatif": "رابط المرفق",
    "MIME type": "نوع MIME",
    "Ajouter justificatif": "إضافة مرفق",
    "Liste des justificatifs": "قائمة المرفقات",
    Fichier: "الملف",
    MIME: "MIME",
    "Ajoute le": "أضيف في",
    "Selectionner une absence.": "اختر غياباً.",
    "Aucun justificatif.": "لا توجد مرفقات.",
    "Composez des creneaux lisibles puis controlez la semaine complete en un seul coup d'oeil.":
      "أنشئ حصصاً واضحة وتابع الأسبوع كاملاً بنظرة واحدة.",
    Matiere: "المادة",
    Jour: "اليوم",
    Debut: "البداية",
    Fin: "النهاية",
    Salle: "القاعة",
    Ajouter: "إضافة",
    "Grille d'emploi du temps": "شبكة الجدول الدراسي",
    "Recherche par classe et par jour.": "بحث حسب الصف واليوم.",
    Heure: "الوقت",
    "Aucun cours.": "لا توجد حصص.",
    "Vue hebdo": "عرض أسبوعي",
    "Aucun cours": "لا توجد حصة",
    "Envoyer les notifications en attente": "إرسال الإشعارات المعلقة",
    "Programmez les messages importants avec un flux plus propre pour les equipes.":
      "جدول الرسائل المهمة ضمن مسار عمل أوضح للفرق.",
    Titre: "العنوان",
    Message: "الرسالة",
    Audience: "الفئة المستهدفة",
    Canal: "القناة",
    "Cible explicite": "مستلم محدد",
    "Programmer l'envoi": "جدولة الإرسال",
    "Historique notifications": "سجل الإشعارات",
    "Suivi des envois, statuts et relances.": "متابعة الإرسال والحالات وإعادات المحاولة.",
    Distribution: "التسليم",
    Cible: "الهدف",
    Fournisseur: "المزود",
    Tentatives: "المحاولات",
    "Aucune notification.": "لا توجد إشعارات.",
    "Marquer comme envoyee": "وضعها كمرسلة",
    Application: "التطبيق",
    "E-mail": "البريد الإلكتروني",
    "En file": "في الانتظار",
    Filtrer: "تصفية",
    Reinitialiser: "إعادة تعيين",
    "Choisir...": "اختر...",
    Tous: "الكل",
    Toutes: "الكل",
    Aucun: "لا شيء",
    "Filtrer par matricule, nom ou prenom": "تصفية حسب الرقم أو الاسم أو الاسم الأول",
    "Total du": "إجمالي المستحق",
    "Montant encaisse": "المبلغ المحصل",
    "Reste a recouvrer": "المتبقي للتحصيل",
    "Taux recouvrement": "نسبة التحصيل",
    Libelle: "الوصف",
    Annee: "السنة",
    Niveau: "المستوى",
    Total: "الإجمالي",
    Numero: "الرقم",
    Paye: "المدفوع",
    Reste: "المتبقي",
    Recu: "الإيصال",
    Montant: "المبلغ",
    Mode: "الطريقة",
    Code: "الرمز",
    Contact: "الاتصال",
    Adhesion: "تاريخ الانضمام",
    Categorie: "الفئة",
    Lieu: "المكان",
    Transactions: "المعاملات",
    Periode: "الفترة",
    Evaluation: "التقييم",
    Type: "النوع",
    Note: "الدرجة",
    Moyenne: "المعدل",
    Rang: "الترتيب",
    Appreciation: "التقدير",
    Utilisateur: "المستخدم",
    Ressource: "المورد",
    "ID Ressource": "معرّف المورد",
    Payload: "الحمولة",
    "Aucune donnee.": "لا توجد بيانات.",
    "Aucun membre.": "لا يوجد أعضاء.",
    "Aucune activite.": "لا توجد أنشطة.",
    "Aucun don.": "لا توجد تبرعات.",
    "Aucun resume calcule pour l'instant.": "لا يوجد ملخص محسوب حالياً.",
    "Actualiser KPI": "تحديث المؤشرات",
    "Eleves actifs": "الطلاب النشطون",
    "Inscriptions actives": "التسجيلات النشطة",
    Recouvrement: "التحصيل",
    "Dons mosquee": "تبرعات المسجد",
    "Alertes notifications": "تنبيهات الإشعارات",
    "Journal de conformite": "سجل الامتثال",
    "Livrables d'export": "مخرجات التصدير",
    "Fermer la notification d'erreur": "إغلاق إشعار الخطأ",
    "Fermer la notification": "إغلاق الإشعار",
    "Liste des eleves": "قائمة الطلاب",
    "Synthese du recouvrement": "ملخص التحصيل",
    "Suivez la sante financiere avant de passer aux operations de saisie.":
      "تابع الوضع المالي قبل الانتقال إلى عمليات الإدخال.",
    "Plans de frais": "خطط الرسوم",
    "Definissez les frais par annee et niveau, puis reutilisez-les pour la facturation.":
      "حدد الرسوم حسب السنة والمستوى ثم أعد استخدامها للفوترة.",
    "Creer le plan de frais": "إنشاء خطة رسوم",
    "Liste des plans de frais": "قائمة خطط الرسوم",
    Factures: "الفواتير",
    "Associez un eleve, une annee et un montant du pour generer une facture claire.":
      "اربط طالباً وسنة ومبلغاً مستحقاً لإنشاء فاتورة واضحة.",
    "Creer facture": "إنشاء فاتورة",
    "Liste factures": "قائمة الفواتير",
    "Enregistrez chaque encaissement et rattachez-le a la facture correspondante.":
      "سجل كل دفعة واربطها بالفاتورة المناسبة.",
    "Enregistrer paiement": "تسجيل دفعة",
    "Historique paiements": "سجل المدفوعات",
    "Registre des membres": "سجل الأعضاء",
    "Activites mosquee": "أنشطة المسجد",
    "Dons & recettes": "التبرعات والإيرادات",
    "Synthese du module mosquee": "ملخص وحدة المسجد",
    "Filtres notes": "مرشحات الدرجات",
    "Ciblez une classe, une matiere et une periode pour travailler sans surcharge.":
      "حدد صفاً ومادةً وفترةً للعمل دون ضغط زائد.",
    "Saisie note": "إدخال درجة",
    "Saisissez une evaluation a la fois avec validations inline.":
      "أدخل تقييماً واحداً في كل مرة مع تحقق فوري.",
    "Enregistrer note": "حفظ الدرجة",
    "Notes enregistrees": "الدرجات المحفوظة",
    "Moyennes et rangs": "المعدلات والترتيب",
    "Generation bulletin PDF": "إنشاء كشف PDF",
    "Generez un bulletin par eleve/periode et ouvrez le PDF en un clic.":
      "أنشئ كشفاً لكل طالب/فترة وافتح PDF بنقرة واحدة.",
    "Generer bulletin": "إنشاء كشف",
    "Bulletins generes": "الكشوف المنشأة",
    "Filtrer la fenetre de pilotage": "تصفية نافذة التحليلات"
  }
};

const PATTERN_TRANSLATIONS: Record<TargetLanguage, PatternTranslation[]> = {
  en: [
    {
      pattern: /^Passer en (.+)$/u,
      translate: (match, translate) => `Switch to ${translate(match[1])}`
    },
    {
      pattern: /^Passer de (.+) a (.+)$/u,
      translate: (match, translate) => `Switch from ${translate(match[1])} to ${translate(match[2])}`
    },
    {
      pattern: /^\|\s*Annee:$/u,
      translate: () => "| Year:"
    },
    {
      pattern: /^Annee:\s*(.+)$/u,
      translate: (match) => `Year: ${match[1]}`
    },
    {
      pattern: /^Derniere sync:\s*(.+)$/u,
      translate: (match) => `Last sync: ${match[1]}`
    },
    {
      pattern: /^Maj:\s*(.+)$/u,
      translate: (match) => `Updated: ${match[1]}`
    },
    {
      pattern: /^Actifs:\s*(.+)$/u,
      translate: (match) => `Active: ${match[1]}`
    },
    {
      pattern: /^Droits (.+) mis a jour\.$/u,
      translate: (match, translate) => `${translate(match[1])} permissions updated.`
    },
    {
      pattern: /^Export (.+) (PDF|EXCEL) genere \((\d+) ligne\(s\)\)\.$/u,
      translate: (match, translate) => `Generated ${translate(match[1])} ${match[2]} export (${match[3]} row(s)).`
    },
    {
      pattern: /^Export audit (PDF|EXCEL) genere \((\d+) ligne\(s\)\)\.$/u,
      translate: (match) => `Generated audit ${match[1]} export (${match[2]} row(s)).`
    },
    {
      pattern: /^Recu (.+) ouvert\.$/u,
      translate: (match) => `Receipt ${match[1]} opened.`
    },
    {
      pattern: /^Premier echec:\s*(.+)\s-\s(.+)$/u,
      translate: (match) => `First failure: ${match[1]} - ${match[2]}`
    },
    {
      pattern: /^Selection active:\s*(.+)\s-\s(.+)$/u,
      translate: (match) => `Active selection: ${match[1]} - ${match[2]}`
    },
    {
      pattern: /^Nouvelle tentative (.+)$/u,
      translate: (match) => `Retry ${match[1]}`
    },
    {
      pattern: /^(\d+) notification\(s\) envoyee\(s\)\.$/u,
      translate: (match) => `${match[1]} notification(s) sent.`
    }
  ],
  ar: [
    {
      pattern: /^Passer en (.+)$/u,
      translate: (match, translate) => `الانتقال إلى ${translate(match[1])}`
    },
    {
      pattern: /^Passer de (.+) a (.+)$/u,
      translate: (match, translate) => `التبديل من ${translate(match[1])} إلى ${translate(match[2])}`
    },
    {
      pattern: /^\|\s*Annee:$/u,
      translate: () => "| السنة:"
    },
    {
      pattern: /^Annee:\s*(.+)$/u,
      translate: (match) => `السنة: ${match[1]}`
    },
    {
      pattern: /^Derniere sync:\s*(.+)$/u,
      translate: (match) => `آخر مزامنة: ${match[1]}`
    },
    {
      pattern: /^Maj:\s*(.+)$/u,
      translate: (match) => `آخر تحديث: ${match[1]}`
    },
    {
      pattern: /^Actifs:\s*(.+)$/u,
      translate: (match) => `النشطون: ${match[1]}`
    },
    {
      pattern: /^Droits (.+) mis a jour\.$/u,
      translate: (match, translate) => `تم تحديث صلاحيات ${translate(match[1])}.`
    },
    {
      pattern: /^Export (.+) (PDF|EXCEL) genere \((\d+) ligne\(s\)\)\.$/u,
      translate: (match, translate) => `تم إنشاء تصدير ${translate(match[1])} بصيغة ${match[2]} (${match[3]} سطر/أسطر).`
    },
    {
      pattern: /^Export audit (PDF|EXCEL) genere \((\d+) ligne\(s\)\)\.$/u,
      translate: (match) => `تم إنشاء تصدير التدقيق بصيغة ${match[1]} (${match[2]} سطر/أسطر).`
    },
    {
      pattern: /^Recu (.+) ouvert\.$/u,
      translate: (match) => `تم فتح الإيصال ${match[1]}.`
    },
    {
      pattern: /^Premier echec:\s*(.+)\s-\s(.+)$/u,
      translate: (match) => `أول فشل: ${match[1]} - ${match[2]}`
    },
    {
      pattern: /^Selection active:\s*(.+)\s-\s(.+)$/u,
      translate: (match) => `العنصر النشط: ${match[1]} - ${match[2]}`
    },
    {
      pattern: /^Nouvelle tentative (.+)$/u,
      translate: (match) => `إعادة المحاولة ${match[1]}`
    },
    {
      pattern: /^(\d+) notification\(s\) envoyee\(s\)\.$/u,
      translate: (match) => `تم إرسال ${match[1]} إشعار/إشعارات.`
    }
  ]
};

const normalizeSource = (value: string): string => value.replace(/\s+/gu, " ").trim();

const restorePadding = (source: string, translated: string): string => {
  const leadingWhitespace = source.match(/^\s*/u)?.[0] || "";
  const trailingWhitespace = source.match(/\s*$/u)?.[0] || "";
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
};

export const translateUiString = (language: UiLanguage, source: string): string => {
  if (language === "fr") return source;

  const normalizedSource = normalizeSource(source);
  if (!normalizedSource) return source;

  const exactMatch = EXACT_TRANSLATIONS[language][normalizedSource];
  if (exactMatch) {
    return restorePadding(source, exactMatch);
  }

  for (const rule of PATTERN_TRANSLATIONS[language]) {
    const match = rule.pattern.exec(normalizedSource);
    if (!match) continue;
    return restorePadding(source, rule.translate(match, (value) => translateUiString(language, value)));
  }

  return source;
};

const shouldTranslateTextNode = (node: Text): boolean => {
  const source = node.nodeValue;
  if (!source || !normalizeSource(source)) return false;

  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP_TAGS.has(parent.tagName)) return false;
  if (parent.closest("[data-i18n-skip='true']")) return false;

  return true;
};

const translateTextNode = (node: Text, language: UiLanguage): void => {
  if (!shouldTranslateTextNode(node)) return;

  const source = textSourceMap.get(node) ?? node.nodeValue ?? "";
  if (!textSourceMap.has(node)) {
    textSourceMap.set(node, source);
  }

  const translated = translateUiString(language, source);
  if (node.nodeValue !== translated) {
    node.nodeValue = translated;
  }
};

const translateAttributes = (element: Element, language: UiLanguage): void => {
  let sourceAttributes = attributeSourceMap.get(element);
  if (!sourceAttributes) {
    sourceAttributes = new Map<AttributeName, string>();
    attributeSourceMap.set(element, sourceAttributes);
  }

  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attributeName)) continue;

    if (!sourceAttributes.has(attributeName)) {
      sourceAttributes.set(attributeName, element.getAttribute(attributeName) || "");
    }

    const source = sourceAttributes.get(attributeName) || "";
    const translated = translateUiString(language, source);
    if (element.getAttribute(attributeName) !== translated) {
      element.setAttribute(attributeName, translated);
    }
  }
};

const translateTree = (root: Element, language: UiLanguage): void => {
  translateAttributes(root, language);

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentTextNode = textWalker.nextNode();
  while (currentTextNode) {
    translateTextNode(currentTextNode as Text, language);
    currentTextNode = textWalker.nextNode();
  }

  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let currentElementNode = elementWalker.nextNode();
  while (currentElementNode) {
    translateAttributes(currentElementNode as Element, language);
    currentElementNode = elementWalker.nextNode();
  }
};

export const useDomTranslation = (rootRef: RefObject<Element>, language: UiLanguage): void => {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frameId = 0;
    const runTranslation = (): void => {
      frameId = 0;
      translateTree(root, language);
    };

    runTranslation();

    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(runTranslation);
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [language, rootRef]);
};
