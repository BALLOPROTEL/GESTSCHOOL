import type { ModuleIconName } from "../app-types";

export function ModuleIcon(props: { name: ModuleIconName }): JSX.Element {
  const { name } = props;

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 1a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2 20a6 6 0 0 1 12 0H2Zm12 0a5 5 0 0 1 8 0h-8Z" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 4.1 4 1.5v3.4c0 3.4-1.9 6.7-4 8.1-2.1-1.4-4-4.7-4-8.1V7.6l4-1.5Z" />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 2h6l1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3l1-2Zm-2 8h10v2H7v-2Zm0 4h10v2H7v-2Z" />
      </svg>
    );
  }

  if (name === "graduation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 10 5-10 5L2 8l10-5Zm-6 8 6 3 6-3v4a6 6 0 1 1-12 0v-4Z" />
      </svg>
    );
  }

  if (name === "wallet") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7a3 3 0 0 1 3-3h12v3h3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Zm12 5h6v3h-6a1.5 1.5 0 1 1 0-3Z" />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4Zm16 0h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4Z" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm-2 8h14v10H5V10Zm3 3h3v3H8v-3Z" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6l5 3 1-1.7-4-2.3V7Z" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a6 6 0 0 1 6 6v3c0 1.5.6 3 1.7 4.1L21 16v2H3v-2l1.3-.9A5.8 5.8 0 0 0 6 11V8a6 6 0 0 1 6-6Zm0 20a3 3 0 0 1-2.8-2h5.6A3 3 0 0 1 12 22Z" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16v2H2V3h2v16Zm3-2H5v-6h2v6Zm5 0H9V7h3v10Zm5 0h-3V4h3v13Zm2-8h2v8h-2V9Z" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2 2 2.5 3.2-.3.8 3 2.8 1.6-1.6 2.8.8 3-3 .8-2 2.5-2-2.5-3 .8-.8-3-2.8-1.6 1.6-2.8-.8-3 3.2-.3L12 2Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      </svg>
    );
  }

  if (name === "teacher") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 20a8 8 0 0 1 16 0H4Zm11-8h7v7h-7v-7Zm2 2v3h3v-3h-3Z" />
      </svg>
    );
  }

  if (name === "moon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.7 2.1A9.8 9.8 0 1 0 22 15.8a8.2 8.2 0 0 1-10.1-13.7h1.8Zm-.8 2.5a6.6 6.6 0 1 1-7.4 9.8 8.3 8.3 0 0 0 7.4-9.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-8 17a8 8 0 0 1 16 0H4Z" />
    </svg>
  );
}
