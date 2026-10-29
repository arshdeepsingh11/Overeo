"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../../ui/Icon";
import { LogoMark } from "../../ui/Logo";
import { openSI, setTheme, useStore } from "../../core/store";
import { navigate } from "../../core/routes";
import { setLocked, switchMode, useSpace } from "../../personal/space";
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
  { href: "/app/diary", icon: "book", key: "diary.title" },
  { href: "/app/recap", icon: "play", key: "today.recap" },
  { href: "/app/me", icon: "user", key: "nav.me" },
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
  const initials = (account?.name ?? "·").slice(0, 1).toUpperCase();

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
            <Link href="/app/me" className="p-avatar" aria-label={account?.name ?? "Me"} title={account?.name}>
              {initials}
            </Link>
          </div>
        </header>
        <div className="p-content">{children}</div>
      </div>
    </div>
  );
}

/** Which space is showing — always visible, switchable in one tap. */
function SpaceSwitch() {
  const t = useT();
  const mode = useSpace((s) => s.mode);
  const own = useSpace((s) => s.own);
  const account = useSpace((s) => s.account);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div ref={ref} className="p-space">
      <button className="p-space-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="p-av">{(account?.name ?? "·").slice(0, 1).toUpperCase()}</span>
        <span className="p-space-t">
          <b>{account?.name ?? "…"}</b>
          <span className={`p-space-m ${mode}`}>{mode === "sample" ? t("space.sample") : t("space.mine")}</span>
        </span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="p-space-menu" role="menu">
          {own && (
            <button role="menuitem" className={mode === "real" ? "on" : ""} onClick={() => (switchMode("real"), setOpen(false))}>
              <span className="p-av sm">{own.name.slice(0, 1).toUpperCase()}</span> {own.name} · {t("space.mine")}
              {mode === "real" && <Icon name="check" size={14} />}
            </button>
          )}
          <button role="menuitem" className={mode === "sample" ? "on" : ""} onClick={() => (switchMode("sample"), setOpen(false))}>
            <span className="p-av sm sample">M</span> {t("space.sample")}
            {mode === "sample" && <Icon name="check" size={14} />}
          </button>
          {!own && (
            <Link role="menuitem" href="/app/welcome" onClick={() => setOpen(false)}>
              <Icon name="plus" size={14} /> {t("space.create")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
