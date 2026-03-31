import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export type HeaderNavigationAction = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  helperText?: string;
  onSelect: () => void;
};

export type HeaderPreferenceAction = {
  id: string;
  label: string;
  helperText?: string;
  iconSrc?: string;
  onSelect: () => void;
};

export type HeaderNavigationGroup = {
  id: string;
  label: string;
  helperText?: string;
  items: HeaderNavigationAction[];
};

type HeaderNavigationProps = {
  brandName: string;
  logoAlt: string;
  logoSrc: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  dashboard: HeaderNavigationAction;
  scolarite: HeaderNavigationAction[];
  schoolLife: HeaderNavigationAction[];
  settings: HeaderNavigationAction[];
  settingsGroups?: HeaderNavigationGroup[];
  preferences: HeaderPreferenceAction[];
  notifications: {
    active?: boolean;
    count: number;
    iconSrc: string;
    label: string;
    onSelect: () => void;
  };
  user: {
    avatar: string;
    contextLabel: string;
    roleLabel: string;
    secondaryLabel?: string;
    username: string;
    onLogout: () => void;
  };
};

function HeaderSearchBar(props: {
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}): JSX.Element {
  const { onChange, onSubmit, placeholder, value } = props;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <form className="header-searchbar" role="search" onSubmit={submit}>
      <span className="header-searchbar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm9.2 11.8 1.4 1.4-3.1 3.1-1.4-1.4 3.1-3.1Z" />
        </svg>
      </span>
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </form>
  );
}

function HeaderNotificationBell(props: {
  active?: boolean;
  count: number;
  iconSrc: string;
  label: string;
  onSelect: () => void;
}): JSX.Element {
  const { active, count, iconSrc, label, onSelect } = props;

  return (
    <button
      type="button"
      className={`header-icon-button notification-bell ${active ? "is-active" : ""}`.trim()}
      aria-label={label}
      onClick={onSelect}
      title={label}
    >
      <img src={iconSrc} alt="" aria-hidden="true" />
      <span className="notification-badge" aria-live="polite">
        {count > 99 ? "99+" : count}
      </span>
    </button>
  );
}

function HeaderActionButton(props: {
  action: HeaderNavigationAction;
  className?: string;
}): JSX.Element {
  const { action, className } = props;

  return (
    <button
      type="button"
      className={`header-nav-button ${action.active ? "is-active" : ""} ${className || ""}`.trim()}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      <span>{action.label}</span>
    </button>
  );
}

function HeaderDropdownMenu(props: {
  id: string;
  label: string;
  items: HeaderNavigationAction[];
  openId: string | null;
  onOpenChange: (value: string | null) => void;
  extraGroups?: HeaderNavigationGroup[];
  preferences?: HeaderPreferenceAction[];
}): JSX.Element {
  const { id, label, items, openId, onOpenChange, extraGroups = [], preferences = [] } = props;
  const isOpen = openId === id;
  const isActive =
    items.some((item) => item.active) ||
    extraGroups.some((group) => group.items.some((item) => item.active));
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenGroupId(null);
      return;
    }

    const activeGroup = extraGroups.find((group) => group.items.some((item) => item.active));
    setOpenGroupId(activeGroup?.id ?? null);
  }, [extraGroups, isOpen]);

  return (
    <div className={`header-dropdown ${isOpen ? "is-open" : ""}`.trim()}>
      <button
        type="button"
        className={`header-nav-button header-nav-button-with-caret ${
          isActive ? "is-active" : ""
        }`.trim()}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(isOpen ? null : id)}
      >
        <span>{label}</span>
        <span className={`header-nav-caret ${isOpen ? "is-open" : ""}`.trim()} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m6.7 9.3 5.3 5.4 5.3-5.4 1.4 1.4-6.7 6.6-6.7-6.6 1.4-1.4Z" />
          </svg>
        </span>
      </button>

      <div className="header-dropdown-menu" role="menu">
        <div className="header-dropdown-section">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`header-dropdown-item ${item.active ? "is-active" : ""}`.trim()}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onOpenChange(null);
              }}
            >
              <span>{item.label}</span>
              {item.helperText ? <small>{item.helperText}</small> : null}
            </button>
          ))}
        </div>

        {extraGroups.map((group) => (
          <div key={group.id} className="header-dropdown-section">
            <button
              type="button"
              className={`header-dropdown-group-toggle ${
                openGroupId === group.id ? "is-open" : ""
              } ${group.items.some((item) => item.active) ? "is-active" : ""}`.trim()}
              aria-expanded={openGroupId === group.id}
              onClick={() => setOpenGroupId((current) => (current === group.id ? null : group.id))}
            >
              <span>{group.label}</span>
              <span
                className={`header-group-caret ${openGroupId === group.id ? "is-open" : ""}`.trim()}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">
                  <path d="m9.2 6.8 1.4-1.4 6.6 6.6-6.6 6.6-1.4-1.4 5.2-5.2-5.2-5.2Z" />
                </svg>
              </span>
            </button>
            {openGroupId === group.id ? (
              <div className="header-dropdown-submenu">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`header-dropdown-item ${item.active ? "is-active" : ""}`.trim()}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect();
                      onOpenChange(null);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.helperText ? <small>{item.helperText}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {preferences.length > 0 ? (
          <div className="header-dropdown-section header-dropdown-preferences">
            <div className="header-dropdown-title">
              <span>Preferences</span>
              <small>Langue et theme</small>
            </div>
            <div className="header-preferences-grid">
              {preferences.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="header-preference-button"
                  onClick={() => {
                    item.onSelect();
                    onOpenChange(null);
                  }}
                >
                  {item.iconSrc ? <img src={item.iconSrc} alt="" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderUserMenu(props: {
  openId: string | null;
  onOpenChange: (value: string | null) => void;
  user: HeaderNavigationProps["user"];
}): JSX.Element {
  const { openId, onOpenChange, user } = props;
  const isOpen = openId === "user";

  return (
    <div className={`header-dropdown header-user-menu ${isOpen ? "is-open" : ""}`.trim()}>
      <button
        type="button"
        className={`header-user-trigger ${isOpen ? "is-active" : ""}`.trim()}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(isOpen ? null : "user")}
      >
        <span className="header-user-avatar">{user.avatar}</span>
        <span className="header-user-copy">
          <strong>{user.username}</strong>
          <small>{user.roleLabel}</small>
        </span>
        <span className={`header-nav-caret ${isOpen ? "is-open" : ""}`.trim()} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m6.7 9.3 5.3 5.4 5.3-5.4 1.4 1.4-6.7 6.6-6.7-6.6 1.4-1.4Z" />
          </svg>
        </span>
      </button>

      <div className="header-dropdown-menu header-user-dropdown" role="menu">
        <div className="header-user-summary">
          <span className="header-user-avatar large">{user.avatar}</span>
          <div>
            <strong>{user.username}</strong>
            <p>{user.contextLabel}</p>
            {user.secondaryLabel ? <small>{user.secondaryLabel}</small> : null}
          </div>
        </div>
        <button
          type="button"
          role="menuitem"
          className="header-logout-button"
          onClick={() => {
            user.onLogout();
            onOpenChange(null);
          }}
        >
          <span>Deconnexion</span>
        </button>
      </div>
    </div>
  );
}

export function HeaderNavigation(props: HeaderNavigationProps): JSX.Element {
  const {
    brandName,
    dashboard,
    logoAlt,
    logoSrc,
    notifications,
    onSearchChange,
    onSearchSubmit,
    preferences,
    schoolLife,
    scolarite,
    searchPlaceholder,
    searchValue,
    settings,
    settingsGroups = [],
    user
  } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  const mobileSections = useMemo(
    () => [
      { id: "dashboard", label: "Tableau de bord", items: [dashboard] },
      { id: "scolarite", label: "Scolarite", items: scolarite },
      { id: "school-life", label: "Vie scolaire", items: schoolLife },
      { id: "settings", label: "Parametres", items: settings, groups: settingsGroups }
    ],
    [dashboard, schoolLife, scolarite, settings, settingsGroups]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        setMobileOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header ref={rootRef} className="panel app-shell-header global-header-shell">
      <div className="global-header-row">
        <button type="button" className="global-brand" onClick={dashboard.onSelect}>
          <span className="global-brand-logo">
            <img src={logoSrc} alt={logoAlt} />
          </span>
          <span className="global-brand-copy">
            <strong>GestSchool</strong>
            <small>{brandName}</small>
          </span>
        </button>

        <div className="global-header-center">
          <div className="global-header-search">
            <HeaderSearchBar
              value={searchValue}
              placeholder={searchPlaceholder}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
            />
          </div>

          <nav className="global-header-nav" aria-label="Navigation principale">
            <HeaderActionButton action={dashboard} />
            <HeaderDropdownMenu
              id="scolarite"
              label="Scolarite"
              items={scolarite}
              openId={openId}
              onOpenChange={setOpenId}
            />
            <HeaderDropdownMenu
              id="school-life"
              label="Vie scolaire"
              items={schoolLife}
              openId={openId}
              onOpenChange={setOpenId}
            />
            <HeaderDropdownMenu
              id="settings"
              label="Parametres"
              items={settings}
              extraGroups={settingsGroups}
              preferences={preferences}
              openId={openId}
              onOpenChange={setOpenId}
            />
          </nav>
        </div>

        <div className="global-header-actions">
          <HeaderNotificationBell {...notifications} />
          <HeaderUserMenu user={user} openId={openId} onOpenChange={setOpenId} />
          <button
            type="button"
            className={`header-mobile-toggle ${mobileOpen ? "is-open" : ""}`.trim()}
            aria-expanded={mobileOpen}
            aria-controls="header-mobile-panel"
            onClick={() => {
              setOpenId(null);
              setMobileOpen((previous) => !previous);
            }}
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16v2H4V7Zm0 7h16v2H4v-2Z" />
              </svg>
            </span>
            <span>Menu</span>
          </button>
        </div>
      </div>

      <div
        id="header-mobile-panel"
        className={`header-mobile-panel ${mobileOpen ? "is-open" : ""}`.trim()}
      >
        <HeaderSearchBar
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
        />

        <div className="header-mobile-sections">
          {mobileSections.map((section) => (
            <section key={section.id} className="header-mobile-section">
              <p>{section.label}</p>
              <div className="header-mobile-links">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect();
                      setMobileOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.helperText ? <small>{item.helperText}</small> : null}
                  </button>
                ))}
              </div>
              {section.groups?.map((group) => (
                <div key={group.id} className="header-mobile-subsection">
                  <p>{group.label}</p>
                  <div className="header-mobile-links">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                        disabled={item.disabled}
                        onClick={() => {
                          item.onSelect();
                          setMobileOpen(false);
                        }}
                      >
                        <span>{item.label}</span>
                        {item.helperText ? <small>{item.helperText}</small> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}

          <section className="header-mobile-section">
            <p>Preferences</p>
            <div className="header-preferences-grid mobile">
              {preferences.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="header-preference-button"
                  onClick={() => {
                    item.onSelect();
                    setMobileOpen(false);
                  }}
                >
                  {item.iconSrc ? <img src={item.iconSrc} alt="" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="header-mobile-footer">
          <button
            type="button"
            className={`header-mobile-link ${notifications.active ? "is-active" : ""}`.trim()}
            onClick={() => {
              notifications.onSelect();
              setMobileOpen(false);
            }}
          >
            <span>{notifications.label}</span>
            <small>{notifications.count} notification(s)</small>
          </button>
          <div className="header-mobile-user">
            <div>
              <strong>{user.username}</strong>
              <small>{user.roleLabel}</small>
            </div>
            <button type="button" className="header-logout-button" onClick={user.onLogout}>
              <span>Deconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
