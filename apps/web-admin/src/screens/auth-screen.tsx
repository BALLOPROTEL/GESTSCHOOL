import { FormEvent, useEffect, useRef, useState } from "react";

import type { ThemeMode } from "../app-types";
import { UI_LANGUAGE_META, type UiLanguage } from "../i18n";

type AuthApiStatus = "unknown" | "checking" | "online" | "offline" | "reconnecting";
type AuthView = "login" | "forgot" | "first";

const AUTH_LANGUAGE_CODES: Record<UiLanguage, "FR" | "EN" | "AR"> = {
  fr: "FR",
  en: "EN",
  ar: "AR"
};
type AuthScreenProps = {
  schoolName: string;
  themeMode: ThemeMode;
  themeBusy: boolean;
  onSelectTheme: (mode: ThemeMode) => void;
  uiLanguage: UiLanguage;
  languageBusy: boolean;
  onSelectLanguage: (language: UiLanguage) => void;
  apiStatus: AuthApiStatus;
  apiStatusText: string;
  loginForm: {
    username: string;
    password: string;
  };
  loginUsernameError?: string;
  loginPasswordError?: string;
  onLoginFormChange: (patch: Partial<{ username: string; password: string }>) => void;
  rememberMe: boolean;
  onRememberMeChange: (checked: boolean) => void;
  loadingAuth: boolean;
  onSubmitLogin: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  authAssistMode: "none" | "forgot" | "first";
  onShowLogin: () => void;
  onShowForgotPassword: () => void;
  onShowFirstConnection: () => void;
  forgotPasswordForm: {
    username: string;
  };
  onForgotPasswordChange: (patch: Partial<{ username: string }>) => void;
  resetPasswordForm: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  };
  onResetPasswordChange: (
    patch: Partial<{ token: string; newPassword: string; confirmPassword: string }>
  ) => void;
  firstConnectionForm: {
    username: string;
    temporaryPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  onFirstConnectionChange: (
    patch: Partial<{
      username: string;
      temporaryPassword: string;
      newPassword: string;
      confirmPassword: string;
    }>
  ) => void;
  authAssistLoading: boolean;
  onSubmitForgotPassword: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSubmitResetPassword: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSubmitFirstConnection: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

type ToolbarProps = {
  languageBusy: boolean;
  languageMenuOpen: boolean;
  onLanguageMenuRef: (node: HTMLDivElement | null) => void;
  currentLanguageCode: string;
  currentLanguageMeta: (typeof UI_LANGUAGE_META)[UiLanguage];
  uiLanguage: UiLanguage;
  onToggleLanguageMenu: () => void;
  onSelectLanguage: (language: UiLanguage) => void;
  onCloseLanguageMenu: () => void;
  themeMode: ThemeMode;
  themeBusy: boolean;
  onSelectTheme: (mode: ThemeMode) => void;
};

type TextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  label: string;
  icon: "mail" | "lock";
  autoComplete?: string;
};

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  visible: boolean;
  onToggle: () => void;
  label: string;
  autoComplete?: string;
};

function MailIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  );
}

function LockIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="4.75" y="10" width="14.5" height="10" rx="2.25" />
      <path d="M8 10V7.5a4 4 0 1 1 8 0V10" />
      <path d="M12 14.5v2.75" />
    </svg>
  );
}

function EyeIcon(props: { open: boolean }): JSX.Element {
  const { open } = props;
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <path d="M3 3 21 21" />
      <path d="M10.58 5.18A10.76 10.76 0 0 1 12 5.1c5.9 0 9.5 6 9.5 6a17.68 17.68 0 0 1-2.95 3.66" />
      <path d="M14.82 14.94A3.12 3.12 0 0 1 9.1 9.18" />
      <path d="M6.36 6.34A17.96 17.96 0 0 0 2.5 12s3.6 6 9.5 6a10.5 10.5 0 0 0 4.12-.83" />
    </svg>
  );
}

function GlobeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.75 12h16.5" />
      <path d="M12 3.25c2.7 2.5 4.25 5.67 4.25 8.75S14.7 18.25 12 20.75C9.3 18.25 7.75 15.08 7.75 12S9.3 5.75 12 3.25Z" />
    </svg>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.5M12 18.75v2.5M5.46 5.46l1.77 1.77M16.77 16.77l1.77 1.77M2.75 12h2.5M18.75 12h2.5M5.46 18.54l1.77-1.77M16.77 7.23l1.77-1.77" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.15 14.2A8.4 8.4 0 1 1 9.8 3.85a7 7 0 1 0 10.35 10.35Z" />
    </svg>
  );
}

function ArrowIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ChevronIcon(props: { open?: boolean }): JSX.Element {
  const { open = false } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function BackIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  );
}

function renderFieldError(message?: string): JSX.Element | null {
  return message ? <span className="field-error auth-canvas__field-error">{message}</span> : null;
}

function TextField(props: TextFieldProps): JSX.Element {
  const { value, onChange, placeholder, required = false, minLength, label, icon, autoComplete } = props;
  return (
    <label className="auth-canvas__field">
      <span className="visually-hidden">{label}</span>
      <span className="auth-canvas__field-icon" aria-hidden="true">
        {icon === "mail" ? <MailIcon /> : <LockIcon />}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function PasswordField(props: PasswordFieldProps): JSX.Element {
  const { value, onChange, placeholder, required = false, minLength, visible, onToggle, label, autoComplete } = props;
  return (
    <label className="auth-canvas__field auth-canvas__field--password">
      <span className="visually-hidden">{label}</span>
      <span className="auth-canvas__field-icon" aria-hidden="true">
        <LockIcon />
      </span>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="auth-canvas__visibility-button"
        onClick={onToggle}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <EyeIcon open={visible} />
      </button>
    </label>
  );
}

function AuthToolbar(props: ToolbarProps): JSX.Element {
  const {
    languageBusy,
    languageMenuOpen,
    onLanguageMenuRef,
    currentLanguageCode,
    currentLanguageMeta,
    uiLanguage,
    onToggleLanguageMenu,
    onSelectLanguage,
    onCloseLanguageMenu,
    themeMode,
    themeBusy,
    onSelectTheme
  } = props;

  const isDarkTheme = themeMode === "dark";

  return (
    <div className="auth-canvas__toolbar">
      <div
        ref={onLanguageMenuRef}
        className={`auth-canvas__language ${languageMenuOpen ? "is-open" : ""}`.trim()}
      >
        <button
          type="button"
          className="auth-canvas__language-trigger"
          onClick={onToggleLanguageMenu}
          disabled={languageBusy}
          aria-expanded={languageMenuOpen}
          aria-haspopup="menu"
          aria-label="Selectionner la langue"
          title={currentLanguageMeta.label}
        >
          <span className="auth-canvas__toolbar-icon auth-canvas__toolbar-icon--language" aria-hidden="true">
            <GlobeIcon />
          </span>
          <span className="auth-canvas__language-current" data-i18n-skip="true">{currentLanguageCode}</span>
          <ChevronIcon open={languageMenuOpen} />
        </button>
        {languageMenuOpen ? (
          <div className="auth-canvas__language-menu" role="menu">
            {(["fr", "en", "ar"] as UiLanguage[]).map((language) => {
              const metadata = UI_LANGUAGE_META[language];
              const active = language === uiLanguage;
              return (
                <button
                  key={language}
                  type="button"
                  className={`auth-canvas__language-option ${active ? "is-active" : ""}`.trim()}
                  onClick={() => {
                    onSelectLanguage(language);
                    onCloseLanguageMenu();
                  }}
                  role="menuitemradio"
                  aria-checked={active}
                >
                  <img src={metadata.iconSrc} alt="" aria-hidden="true" />
                  <span data-i18n-skip="true">{AUTH_LANGUAGE_CODES[language]}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="auth-canvas__mode-shell" role="group" aria-label="Selection du theme">
        <span className="auth-canvas__mode-label">Mode</span>
        <span className="auth-canvas__mode-sun" aria-hidden="true">
          <SunIcon />
        </span>
        <button
          type="button"
          className={`auth-canvas__theme-toggle ${isDarkTheme ? "is-dark" : "is-light"}`.trim()}
          onClick={() => onSelectTheme(isDarkTheme ? "light" : "dark")}
          disabled={themeBusy}
          aria-pressed={isDarkTheme}
          aria-label={isDarkTheme ? "Activer le mode clair" : "Activer le mode sombre"}
          title={isDarkTheme ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          <span className="auth-canvas__theme-track" aria-hidden="true">
            <span className="auth-canvas__theme-thumb">
              {isDarkTheme ? <MoonIcon /> : <SunIcon />}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

export function AuthScreen(props: AuthScreenProps): JSX.Element {
  const {
    schoolName,
    themeMode,
    themeBusy,
    onSelectTheme,
    uiLanguage,
    languageBusy,
    onSelectLanguage,
    apiStatus,
    apiStatusText,
    loginForm,
    loginUsernameError,
    loginPasswordError,
    onLoginFormChange,
    rememberMe,
    onRememberMeChange,
    loadingAuth,
    onSubmitLogin,
    authAssistMode,
    onShowLogin,
    onShowForgotPassword,
    onShowFirstConnection,
    forgotPasswordForm,
    onForgotPasswordChange,
    resetPasswordForm,
    onResetPasswordChange,
    firstConnectionForm,
    onFirstConnectionChange,
    authAssistLoading,
    onSubmitForgotPassword,
    onSubmitResetPassword,
    onSubmitFirstConnection
  } = props;

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [temporaryPasswordVisible, setTemporaryPasswordVisible] = useState(false);
  const [firstPasswordVisible, setFirstPasswordVisible] = useState(false);
  const [firstConfirmVisible, setFirstConfirmVisible] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const currentView: AuthView =
    authAssistMode === "forgot" ? "forgot" : authAssistMode === "first" ? "first" : "login";
  const currentLanguageMeta = UI_LANGUAGE_META[uiLanguage];
  const currentLanguageCode = AUTH_LANGUAGE_CODES[uiLanguage];
  const heroLabel =
    currentView === "forgot"
      ? "Mot de passe oublie?"
      : currentView === "first"
        ? "Activer mon compte"
        : "Connexion";
  const heroContextCopy =
    currentView === "forgot"
      ? "Recuperez l'acces a votre compte"
      : currentView === "first"
        ? "Finalisez votre premiere connexion avec le mot de passe temporaire recu."
        : "Connectez-vous a votre compte";

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const renderLoginView = (): JSX.Element => (
    <>
      <header className="auth-canvas__card-header">
        <span className="auth-canvas__card-kicker">Connexion</span>
        <h2>Connexion</h2>
        <p>Connectez-vous a votre compte</p>
      </header>

      {apiStatus !== "online" ? (
        <p className={`auth-api-banner auth-api-banner-${apiStatus}`.trim()} role="status">
          {apiStatusText}
        </p>
      ) : null}

      <form className="auth-canvas__form" onSubmit={onSubmitLogin}>
        <TextField
          value={loginForm.username}
          onChange={(value) => onLoginFormChange({ username: value })}
          placeholder="Email ou Identifiant"
          required
          label="Email ou identifiant"
          icon="mail"
          autoComplete="username"
        />
        {renderFieldError(loginUsernameError)}

        <PasswordField
          value={loginForm.password}
          onChange={(value) => onLoginFormChange({ password: value })}
          placeholder="Mot de passe"
          required
          minLength={8}
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((prev) => !prev)}
          label="Mot de passe"
          autoComplete="current-password"
        />
        {renderFieldError(loginPasswordError)}

        <div className="auth-canvas__inline">
          <label className="auth-canvas__check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => onRememberMeChange(event.target.checked)}
            />
            <span>Se souvenir de moi</span>
          </label>
          <button type="button" className="auth-canvas__link" onClick={onShowForgotPassword}>
            Mot de passe oublie?
          </button>
        </div>

        <button type="submit" className="auth-canvas__submit" disabled={loadingAuth}>
          <span>{loadingAuth ? "Connexion..." : "Connexion"}</span>
          <ArrowIcon />
        </button>
      </form>

      <div className="auth-canvas__footer-block">
        <span className="auth-canvas__divider" aria-hidden="true" />
        <p>Premiere connexion ?</p>
        <button type="button" className="auth-canvas__link auth-canvas__link--cta" onClick={onShowFirstConnection}>
          Activer mon compte
        </button>
      </div>
    </>
  );

  const renderForgotView = (): JSX.Element => (
    <>
      <header className="auth-canvas__card-header">
        <button type="button" className="auth-canvas__back-link" onClick={onShowLogin}>
          <BackIcon />
          Retour connexion
        </button>
        <span className="auth-canvas__card-kicker">Mot de passe oublie?</span>
        <h2>Mot de passe oublie?</h2>
        <p>Recuperez l'acces a votre compte</p>
      </header>

      {apiStatus !== "online" ? (
        <p className={`auth-api-banner auth-api-banner-${apiStatus}`.trim()} role="status">
          {apiStatusText}
        </p>
      ) : null}

      <section className="auth-canvas__panel auth-canvas__panel--soft">
        <div className="auth-canvas__panel-copy">
          <h3>Recevoir les instructions</h3>
          <p>Entrez votre identifiant pour demander un code de reinitialisation.</p>
        </div>
        <form className="auth-canvas__form auth-canvas__form--compact" onSubmit={onSubmitForgotPassword}>
          <TextField
            value={forgotPasswordForm.username}
            onChange={(value) => onForgotPasswordChange({ username: value })}
            placeholder="Identifiant"
            required
            label="Identifiant"
            icon="mail"
            autoComplete="username"
          />
          <button type="submit" className="auth-canvas__secondary-submit" disabled={authAssistLoading}>
            {authAssistLoading ? "Envoi..." : "Envoyer les instructions"}
          </button>
        </form>
      </section>

      <section className="auth-canvas__panel auth-canvas__panel--muted">
        <div className="auth-canvas__panel-copy">
          <h3>Valider la reinitialisation</h3>
          <p>Saisissez le code recu et choisissez un nouveau mot de passe securise.</p>
        </div>
        <form className="auth-canvas__grid-form" onSubmit={onSubmitResetPassword}>
          <label className="auth-canvas__stacked-field">
            <span>Code de reinitialisation</span>
            <input
              value={resetPasswordForm.token}
              onChange={(event) => onResetPasswordChange({ token: event.target.value })}
              required
            />
          </label>
          <PasswordField
            value={resetPasswordForm.newPassword}
            onChange={(value) => onResetPasswordChange({ newPassword: value })}
            placeholder="Nouveau mot de passe"
            required
            minLength={12}
            visible={resetPasswordVisible}
            onToggle={() => setResetPasswordVisible((prev) => !prev)}
            label="Nouveau mot de passe"
            autoComplete="new-password"
          />
          <PasswordField
            value={resetPasswordForm.confirmPassword}
            onChange={(value) => onResetPasswordChange({ confirmPassword: value })}
            placeholder="Confirmation"
            required
            minLength={12}
            visible={resetConfirmVisible}
            onToggle={() => setResetConfirmVisible((prev) => !prev)}
            label="Confirmation"
            autoComplete="new-password"
          />
          <button type="submit" className="auth-canvas__secondary-submit" disabled={authAssistLoading}>
            {authAssistLoading ? "Validation..." : "Valider la reinitialisation"}
          </button>
        </form>
      </section>

      <div className="auth-canvas__footer-links">
        <button type="button" className="auth-canvas__link" onClick={onShowLogin}>
          Retour connexion
        </button>
        <button type="button" className="auth-canvas__link" onClick={onShowFirstConnection}>
          Activer mon compte
        </button>
      </div>
    </>
  );

  const renderFirstConnectionView = (): JSX.Element => (
    <>
      <header className="auth-canvas__card-header">
        <button type="button" className="auth-canvas__back-link" onClick={onShowLogin}>
          <BackIcon />
          Retour connexion
        </button>
        <span className="auth-canvas__card-kicker">Activer mon compte</span>
        <h2>Activer mon compte</h2>
        <p>Finalisez votre premiere connexion avec le mot de passe temporaire recu.</p>
      </header>

      {apiStatus !== "online" ? (
        <p className={`auth-api-banner auth-api-banner-${apiStatus}`.trim()} role="status">
          {apiStatusText}
        </p>
      ) : null}

      <section className="auth-canvas__panel auth-canvas__panel--soft auth-canvas__panel--wide">
        <form className="auth-canvas__grid-form" onSubmit={onSubmitFirstConnection}>
          <label className="auth-canvas__stacked-field">
            <span>Identifiant</span>
            <input
              value={firstConnectionForm.username}
              onChange={(event) => onFirstConnectionChange({ username: event.target.value })}
              required
              autoComplete="username"
            />
          </label>
          <PasswordField
            value={firstConnectionForm.temporaryPassword}
            onChange={(value) => onFirstConnectionChange({ temporaryPassword: value })}
            placeholder="Mot de passe temporaire"
            required
            minLength={8}
            visible={temporaryPasswordVisible}
            onToggle={() => setTemporaryPasswordVisible((prev) => !prev)}
            label="Mot de passe temporaire"
          />
          <PasswordField
            value={firstConnectionForm.newPassword}
            onChange={(value) => onFirstConnectionChange({ newPassword: value })}
            placeholder="Nouveau mot de passe"
            required
            minLength={12}
            visible={firstPasswordVisible}
            onToggle={() => setFirstPasswordVisible((prev) => !prev)}
            label="Nouveau mot de passe"
            autoComplete="new-password"
          />
          <PasswordField
            value={firstConnectionForm.confirmPassword}
            onChange={(value) => onFirstConnectionChange({ confirmPassword: value })}
            placeholder="Confirmation"
            required
            minLength={12}
            visible={firstConfirmVisible}
            onToggle={() => setFirstConfirmVisible((prev) => !prev)}
            label="Confirmation"
            autoComplete="new-password"
          />
          <button type="submit" className="auth-canvas__submit" disabled={authAssistLoading}>
            <span>{authAssistLoading ? "Activation..." : "Activer mon compte"}</span>
            <ArrowIcon />
          </button>
        </form>
      </section>

      <div className="auth-canvas__footer-links">
        <button type="button" className="auth-canvas__link" onClick={onShowLogin}>
          Retour connexion
        </button>
        <button type="button" className="auth-canvas__link" onClick={onShowForgotPassword}>
          Mot de passe oublie?
        </button>
      </div>
    </>
  );

  return (
    <section className="auth-canvas fade-up" data-auth-view={currentView} key={currentView}>
      <article className="auth-canvas__hero">
        <div className="auth-canvas__hero-copy">
          <span className="auth-canvas__hero-chip">{heroLabel}</span>
          <div className="auth-canvas__brand">
            <h1>GestSchool</h1>
            <p className="auth-canvas__subtitle">{schoolName}</p>
            <p className="auth-canvas__description">
              Acces centralise pour administrer les eleves, les enseignants et les parents d'eleves.
            </p>
          </div>
        </div>

        <div className="auth-canvas__hero-context">
          <h3>{heroLabel}</h3>
          <p>{heroContextCopy}</p>
        </div>
      </article>

      <section className="auth-canvas__side">
        <AuthToolbar
          languageBusy={languageBusy}
          languageMenuOpen={languageMenuOpen}
          onLanguageMenuRef={(node) => { languageMenuRef.current = node; }}
          currentLanguageCode={currentLanguageCode}
          currentLanguageMeta={currentLanguageMeta}
          uiLanguage={uiLanguage}
          onToggleLanguageMenu={() => setLanguageMenuOpen((prev) => !prev)}
          onSelectLanguage={onSelectLanguage}
          onCloseLanguageMenu={() => setLanguageMenuOpen(false)}
          themeMode={themeMode}
          themeBusy={themeBusy}
          onSelectTheme={onSelectTheme}
        />

        <section className="auth-canvas__card">
          <div className="auth-canvas__card-inner" key={currentView}>
            {currentView === "login"
              ? renderLoginView()
              : currentView === "forgot"
                ? renderForgotView()
                : renderFirstConnectionView()}
          </div>
        </section>

        <p className="auth-canvas__security-note">Connexion securisee - GestSchool 2026</p>
      </section>
    </section>
  );
}






