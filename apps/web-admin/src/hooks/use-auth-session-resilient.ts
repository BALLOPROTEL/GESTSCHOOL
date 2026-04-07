import { useCallback, useEffect, useRef, useState } from "react";

import type { Session } from "../app-types";
import {
  clearStoredSession,
  persistSession,
  readStoredSession
} from "../services/session-storage";

type UseAuthSessionOptions = {
  apiBaseUrls: string[];
  onAuthError: (message: string) => void;
  onClearData: () => void;
  onRefreshNotice: (message: string) => void;
  onRefreshSuccess: () => void;
};

type AuthPayload = Omit<Session, "tenantId"> & { user: Session["user"] };

type ApiConnectionStatus =
  | "unknown"
  | "checking"
  | "online"
  | "offline"
  | "reconnecting";

type ApiConnectionState = {
  lastFailureAt: number | null;
  nextRetryAt: number | null;
  retryCount: number;
  status: ApiConnectionStatus;
};

type ApiRequestOptions = {
  background?: boolean;
  forceProbe?: boolean;
};

const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_API_BASE_URL = "/api/v1";

const INITIAL_API_CONNECTION_STATE: ApiConnectionState = {
  lastFailureAt: null,
  nextRetryAt: null,
  retryCount: 0,
  status: "unknown"
};

const createUnavailableResponse = (): Response =>
  new Response(JSON.stringify({ message: "API indisponible. Reconnexion..." }), {
    status: 503,
    headers: { "Content-Type": "application/json" }
  });

const isHealthyApiResponse = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") return false;
  const status = (payload as { status?: unknown }).status;
  return status === "live" || status === "ok" || status === "ready";
};

export function useAuthSession(options: UseAuthSessionOptions) {
  const {
    apiBaseUrls,
    onAuthError,
    onClearData,
    onRefreshNotice,
    onRefreshSuccess
  } = options;
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [apiConnection, setApiConnection] = useState<ApiConnectionState>(
    INITIAL_API_CONNECTION_STATE
  );
  const activeApiBaseUrlRef = useRef<string>(apiBaseUrls[0] || DEFAULT_API_BASE_URL);
  const sessionRef = useRef<Session | null>(session);
  const apiConnectionRef = useRef<ApiConnectionState>(INITIAL_API_CONNECTION_STATE);
  const probePromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (apiBaseUrls.length === 0) {
      activeApiBaseUrlRef.current = DEFAULT_API_BASE_URL;
      return;
    }

    if (!apiBaseUrls.includes(activeApiBaseUrlRef.current)) {
      activeApiBaseUrlRef.current = apiBaseUrls[0];
    }
  }, [apiBaseUrls]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const updateApiConnection = useCallback(
    (
      updater: (current: ApiConnectionState) => ApiConnectionState
    ): ApiConnectionState => {
      const next = updater(apiConnectionRef.current);
      apiConnectionRef.current = next;
      setApiConnection(next);
      return next;
    },
    []
  );

  const markApiAvailable = useCallback(() => {
    updateApiConnection((current) => {
      if (current.status === "online" && current.retryCount === 0) {
        return current;
      }

      return {
        lastFailureAt: current.lastFailureAt,
        nextRetryAt: null,
        retryCount: 0,
        status: "online"
      };
    });
  }, [updateApiConnection]);

  const markApiUnavailable = useCallback(() => {
    updateApiConnection((current) => {
      const retryCount = current.retryCount + 1;
      const retryDelay = Math.min(
        MAX_BACKOFF_MS,
        INITIAL_BACKOFF_MS * 2 ** Math.max(0, retryCount - 1)
      );
      const now = Date.now();

      return {
        lastFailureAt: now,
        nextRetryAt: now + retryDelay,
        retryCount,
        status:
          current.status === "online" || current.status === "checking"
            ? "offline"
            : "reconnecting"
      };
    });
  }, [updateApiConnection]);

  const resolveApiUrl = useCallback((path: string): string => {
    return `${activeApiBaseUrlRef.current}${path}`;
  }, []);

  const probeApiBaseUrl = useCallback(async (candidateApiBaseUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`${candidateApiBaseUrl}/health/live`, {
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (!contentType.includes("application/json")) {
        return false;
      }

      const payload = (await response.json()) as unknown;
      return isHealthyApiResponse(payload);
    } catch {
      return false;
    }
  }, []);

  const ensureApiAvailable = useCallback(
    async (force = false): Promise<boolean> => {
      const current = apiConnectionRef.current;
      const now = Date.now();

      if (!force) {
        if (current.status === "online") return true;
        if (current.nextRetryAt && current.nextRetryAt > now) return false;
      }

      if (probePromiseRef.current) {
        return probePromiseRef.current;
      }

      updateApiConnection((state) => ({
        ...state,
        status:
          state.status === "online" || state.status === "unknown"
            ? "checking"
            : "reconnecting"
      }));

      const probePromise = (async (): Promise<boolean> => {
        const currentApiBaseUrl = activeApiBaseUrlRef.current;
        const candidates = [
          currentApiBaseUrl,
          ...apiBaseUrls.filter((candidateApiBaseUrl) => candidateApiBaseUrl !== currentApiBaseUrl)
        ];

        try {
          for (const candidateApiBaseUrl of candidates) {
            const ready = await probeApiBaseUrl(candidateApiBaseUrl);
            if (!ready) {
              continue;
            }

            activeApiBaseUrlRef.current = candidateApiBaseUrl;
            markApiAvailable();
            return true;
          }

          markApiUnavailable();
          return false;
        } finally {
          probePromiseRef.current = null;
        }
      })();

      probePromiseRef.current = probePromise;
      return probePromise;
    },
    [apiBaseUrls, markApiAvailable, markApiUnavailable, probeApiBaseUrl, updateApiConnection]
  );

  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const saveSession = useCallback(
    (nextSession: Session) => {
      persistSession(nextSession);
      setSession(nextSession);
      markApiAvailable();
    },
    [markApiAvailable]
  );

  const refresh = useCallback(async (): Promise<Session | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;

    if (!(await ensureApiAvailable())) {
      onRefreshNotice("API indisponible. Reconnexion...");
      return null;
    }

    try {
      const response = await fetch(resolveApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken })
      });
      if (!response.ok) {
        clearSession();
        onClearData();
        onAuthError("Session expiree.");
        return null;
      }
      const payload = (await response.json()) as AuthPayload;
      const nextSession: Session = {
        ...payload,
        tenantId: current.tenantId || payload.user.tenantId
      };
      saveSession(nextSession);
      onRefreshSuccess();
      onRefreshNotice("Session actualisee.");
      return nextSession;
    } catch {
      markApiUnavailable();
      onRefreshNotice("API indisponible. Reconnexion...");
      return null;
    }
  }, [
    clearSession,
    ensureApiAvailable,
    markApiUnavailable,
    onAuthError,
    onClearData,
    onRefreshNotice,
    onRefreshSuccess,
    resolveApiUrl,
    saveSession
  ]);

  const api = useCallback(
    async (
      path: string,
      init: RequestInit = {},
      retry = true,
      options: ApiRequestOptions = {}
    ): Promise<Response> => {
      const { background = false, forceProbe = false } = options;

      if (!(await ensureApiAvailable(forceProbe))) {
        if (!background) {
          onRefreshNotice("API indisponible. Reconnexion...");
        }
        return createUnavailableResponse();
      }

      const send = async (active: Session | null): Promise<Response> => {
        const headers = new Headers(init.headers ?? {});
        if (
          init.body !== undefined &&
          !(init.body instanceof FormData) &&
          !headers.has("Content-Type")
        ) {
          headers.set("Content-Type", "application/json");
        }
        if (active?.accessToken) headers.set("Authorization", `Bearer ${active.accessToken}`);
        if (active?.tenantId) headers.set("x-tenant-id", active.tenantId);
        return fetch(resolveApiUrl(path), { ...init, headers });
      };

      try {
        const first = await send(sessionRef.current);
        markApiAvailable();
        if (!first.ok && first.status === 401 && retry && sessionRef.current?.refreshToken) {
          const next = await refresh();
          if (next) {
            return send(next);
          }
        }
        return first;
      } catch {
        markApiUnavailable();
        if (!background) {
          onRefreshNotice("API indisponible. Reconnexion...");
        }
        return createUnavailableResponse();
      }
    },
    [ensureApiAvailable, markApiAvailable, markApiUnavailable, onRefreshNotice, refresh, resolveApiUrl]
  );

  return {
    api,
    apiConnection,
    clearSession,
    ensureApiAvailable,
    markApiAvailable,
    markApiUnavailable,
    refresh,
    resolveApiUrl,
    saveSession,
    session,
    sessionRef,
    setSession
  };
}
