"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../../ui/Icon";
import { LogoMark } from "../../ui/Logo";
import { openSI, setTheme, useStore } from "../../core/store";
import { navigate } from "../../core/routes";
import { setLocked, switchMode, switchProfile, useSpace } from "../../personal/space";
import { isUnlocked, logOut, useCloud } from "../../cloud/account";
import { PinGate, ProfileOrb, RELATION_LABEL, useNeedsGate } from "./ProfilesScreen";
import { useT } from "../../personal/useT";
import type { TKey } from "../../personal/i18n";

/* =====================================================================
   Her portal — the app shell for /app/*.

   Desktop: a glass sidebar (who she is, which space, her pages) and a
   top bar (log, inbox, Ask SI, lock). Tablet: the sidebar folds to an
   icon rail. Phone: the bottom tab bar from the main shell.
   The public site's navigation and footer stay out of her portal.
   ===================================================================== */

const NAV: { href: string; icon: IconName; key: TKey | null; label?: string; badge?: "inbox" }[] = [
  { href: "/app", icon: "home", key: "nav.today" },
  { href: "/app/track", icon: "plus", key: "nav.track" },
  { href: "/app/inbox", icon: "inbox", key: "inbox.title", badge: "inbox" },
  { href: "/app/agents", icon: "bot", key: "nav.agents" },
  { href: "/app/team", icon: "users", key: null, label: "Ask the team" },
  { href: "/app/diary", icon: "book", key: "diary.title" },
  { href: "/app/recap", icon: "play", key: "today.recap" },
  { href: "/app/visit", icon: "doc", key: null, label: "Visit summary" },
  { href: "/app/me", icon: "user", key: "nav.me" },
  { href: "/why", icon: "heart", key: null, label: "Why OVEREO" },
];

const isOn = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useT();
  const path = (usePathname() ?? "/app").replace(/\/+$/, "") || "/app";
  const ready = useSpace((s) => s.ready);
  const account = useSpace((s) => s.account);
  const mode = useSpace((s) => s.mode);
  const own = useSpace((s) => s.own);
  const lock = useSpace((s) => s.prefs.lock);
  const pending = useSpace((s) => s.inbox.filter((x) => x.status === "pending").length);
  const theme = useStore((s) => s.theme);
  const current = NAV.find((n) => isOn(path, n.href));
  const { gate, pass } = useNeedsGate();
  const [menu, setMenu] = useState(false);

  return (
    <div className="portal">
      <div className="portal-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <aside className="p-side" aria-label="Your space">
        <Link href="/app" className="p-brand" aria-label="OVEREO — Today">
          <LogoMark size={30} />
          <span className="p-brand-t">OVEREO</span>
        </Link>

        <SpaceSwitch />

        <nav className="p-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`p-link ${current?.href === n.href ? "on" : ""}`} aria-current={current?.href === n.href ? "page" : undefined} title={n.key ? t(n.key) : n.label}>
              <Icon name={n.icon} size={18} />
              <span className="p-link-t">{n.key ? t(n.key) : n.label}</span>
              {n.badge === "inbox" && pending > 0 && <span className="p-badge">{pending}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-side-foot">
          <Link href="/" className="p-link subtle" title={t("me.explore")}>
            <Icon name="globe" size={17} />
            <span className="p-link-t">{t("me.explore")}</span>
          </Link>
          <button className="p-link subtle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Appearance">
            <Icon name={theme === "dark" ? "moon" : "sun"} size={17} />
            <span className="p-link-t">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          {lock && own && (
            <button className="p-link subtle" onClick={() => setLocked(true)} title="Lock now">
              <Icon name="lock" size={17} />
              <span className="p-link-t">Lock now</span>
            </button>
          )}
        </div>
      </aside>

      <div className="p-main">
        <header className="p-top">
          <div className="p-top-l">
            <span className={`p-mode ${mode}`}>
              <span className="p-mode-dot" />
              {mode === "sample" ? t("space.sample") : t("space.mine")}
            </span>
            {mode === "sample" && (
              <span className="p-top-note hide-sm">{t("space.sampleNote")}</span>
            )}
          </div>
          <div className="p-top-r">
            {mode === "sample" && !own && ready && (
              <Link href="/app/welcome" className="p-btn primary">
                {t("space.create")}
              </Link>
            )}
            <button className="p-btn" onClick={() => navigate("/app/track")}>
              <Icon name="plus" size={15} /> <span className="hide-sm">Log</span>
            </button>
            <button className="p-icon" onClick={() => navigate("/app/inbox")} aria-label={`${t("inbox.title")}${pending ? `, ${pending} waiting` : ""}`}>
              <Icon name="bell" size={18} />
              {pending > 0 && <span className="p-dot">{pending}</span>}
            </button>
            <button className="p-btn si" onClick={() => openSI()}>
              <Icon name="sparkle" size={15} /> <span className="hide-sm">{t("nav.si")}</span>
            </button>
            <div className="p-acct">
              <button className="p-avatar" onClick={() => setMenu((m) => !m)} aria-label={`${account?.name ?? "Profile"} — switch profile`} aria-expanded={menu}>
                {account ? <ProfileOrb a={account} size={34} /> : "·"}
              </button>
              {menu && <ProfileMenu onClose={() => setMenu(false)} />}
            </div>
          </div>
        </header>
        <div className="p-content">{children}</div>
      </div>
      {gate && (
        <PinGate
          a={gate}
          onOpen={() => pass(gate.id)}
          onCancel={() => {
            switchMode("sample");
            navigate("/app/profiles");
          }}
        />
      )}
    </div>
  );
}

/** Switch profile · add someone · log out — from the avatar, on every screen size. */
function ProfileMenu({ onClose }: { onClose: () => void }) {
  const profiles = useSpace((s) => s.profiles);
  const own = useSpace((s) => s.own);
  const mode = useSpace((s) => s.mode);
  const status = useCloud((s) => s.status);
  const user = useCloud((s) => s.user);
  const sync = useCloud((s) => s.sync);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", away);
      removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const open = (id: string) => {
    const a = profiles.find((p) => p.id === id)!;
    onClose();
    if ((a.cloud && !isUnlocked(a)) || a.pin) {
      navigate("/app/profiles");
      return;
    }
    switchProfile(id);
  };
  return (
    <div ref={ref} className="pmenu" role="menu">
      {user && (
        <div className="pmenu-user">
          <span>{user.email}</span>
          <span className={`pmenu-sync ${sync}`}>{sync === "syncing" ? "Saving…" : sync === "offline" ? "Offline — saved on this phone" : sync === "error" ? "Couldn't save — will retry" : "All saved"}</span>
        </div>
      )}
      {profiles.map((a) => (
        <button key={a.id} role="menuitem" className={mode === "real" && own?.id === a.id ? "on" : ""} onClick={() => open(a.id)}>
          <ProfileOrb a={a} size={30} locked={!!(a.pin || a.cloud?.hasPin)} />
          <span>
            <b>{a.name}</b>
            <small>{RELATION_LABEL[a.relation ?? "self"]}</small>
          </span>
          {mode === "real" && own?.id === a.id && <Icon name="check" size={14} />}
        </button>
      ))}
      <button role="menuitem" className={mode === "sample" ? "on" : ""} onClick={() => (switchMode("sample"), onClose())}>
        <span className="pmenu-sample">M</span>
        <span>
          <b>Maya</b>
          <small>Sample data</small>
        </span>
        {mode === "sample" && <Icon name="check" size={14} />}
      </button>
      <div className="pmenu-sep" />
      <Link role="menuitem" href={profiles.length ? "/app/profiles" : "/app/welcome"} onClick={onClose}>
        <Icon name="plus" size={15} /> {profiles.length ? "Add someone · manage" : "Create your space"}
      </Link>
      <Link role="menuitem" href="/app/me" onClick={onClose}>
        <Icon name="settings" size={15} /> Settings & privacy
      </Link>
      {status === "signed-in" ? (
        <button role="menuitem" onClick={() => void logOut().then(() => (onClose(), navigate("/app/welcome")))}>
          <Icon name="close" size={15} /> Log out
        </button>
      ) : (
        status === "signed-out" && (
          <Link role="menuitem" href="/app/signin" onClick={onClose}>
            <Icon name="user" size={15} /> Log in
          </Link>
        )
      )}
    </div>
  );
}

/** Which space is showing — always visible, switchable in one tap. */
function SpaceSwitch() {
  const t = useT();
  const mode = useSpace((s) => s.mode);
  const account = useSpace((s) => s.account);
  const [open, setOpen] = useState(false);
  return (
    <div className="p-space">
      <button className="p-space-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {account ? <ProfileOrb a={account} size={32} /> : <span className="p-av">·</span>}
        <span className="p-space-t">
          <b>{account?.name ?? "…"}</b>
          <span className={`p-space-m ${mode}`}>{mode === "sample" ? t("space.sample") : t("space.mine")}</span>
        </span>
        <Icon name="down" size={14} />
      </button>
      {open && <ProfileMenu onClose={() => setOpen(false)} />}
    </div>
  );
}
