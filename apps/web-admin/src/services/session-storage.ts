import type { RememberedLogin, Session, ThemeMode } from "../app-types";
import type { UiLanguage } from "../i18n";

const STORAGE_KEY = "gestschool.web-admin.session";
const THEME_STORAGE_KEY = "gestschool.web-admin.theme";
const LANGUAGE_STORAGE_KEY = "gestschool.web-admin.language";
const LOGIN_HINT_STORAGE_KEY = "gestschool.web-admin.login-hint";

export const readRememberedLogin = (defaultTenantId: string): RememberedLogin | null => {
  const raw = localStorage.getItem(LOGIN_HINT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (!parsed.remember) return null;
    if (typeof parsed.username !== "string") return null;
    return {
      username: parsed.username,
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : defaultTenantId,
      remember: true
    };
  } catch {
    return null;
  }
};

const isStoredSession = (value: unknown): value is Session => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session> & { user?: Partial<Session["user"]> };
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.tenantId === "string" &&
    typeof candidate.user?.username === "string" &&
    typeof candidate.user?.role === "string" &&
    typeof candidate.user?.tenantId === "string"
  );
};

export const readStoredSession = (): Session | null => {
  if (typeof window === "undefined") return null;

  const storages = [window.sessionStorage, window.localStorage];
  for (const storage of storages) {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isStoredSession(parsed)) {
        storage.removeItem(STORAGE_KEY);
        continue;
      }
      const normalized: Session = {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        tenantId: parsed.tenantId,
        user: {
          username: parsed.user.username,
          role: parsed.user.role,
          tenantId: parsed.user.tenantId
        }
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      if (storage !== window.sessionStorage) {
        storage.removeItem(STORAGE_KEY);
      }
      return normalized;
    } catch {
      storage.removeItem(STORAGE_KEY);
    }
  }

  return null;
};

export const persistSession = (session: Session): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.localStorage.removeItem(STORAGE_KEY);
};

export const clearStoredSession = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_KEY);
};

export const readThemePreference = (): ThemeMode => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

export const readLanguagePreference = (): UiLanguage => {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "fr" || saved === "en" || saved === "ar") return saved;
  return "fr";
};
