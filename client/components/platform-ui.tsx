import Link from "next/link";
import type { ReactNode } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function PageIntro({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="panel-strong relative overflow-hidden rounded-[36px] px-6 py-8 reveal-up sm:px-8 lg:px-10 lg:py-10">
      <div className="hero-orb left-[5%] top-[-2rem] h-28 w-28 bg-emerald-200/70" />
      <div className="hero-orb right-[10%] top-[12%] h-24 w-24 bg-sky-200/70" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="section-title mt-4 text-5xl sm:text-6xl">{title}</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </section>
  );
}

export function Panel({
  children,
  className = "",
  strong = false
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <section className={cx(strong ? "panel-strong" : "panel", "rounded-[30px] p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
        {subtitle ? <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = false
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className={cx("rounded-[24px] border p-4", accent ? "border-emerald-200 bg-[rgba(154,242,208,0.26)]" : "metric-card")}>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

export function EmptyPanel({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="metric-card rounded-[24px] p-6">
      <p className="text-lg font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}

export function LoadingPanel({ label = "Loading platform data..." }: { label?: string }) {
  return (
    <div className="panel rounded-[30px] p-8 text-sm text-[var(--muted)]">
      {label}
    </div>
  );
}

export function ErrorPanel({
  message
}: {
  message: string;
}) {
  return (
    <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      {message}
    </div>
  );
}

export function NavAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full bg-[linear-gradient(90deg,#9af2d0_0%,#6fd7cd_45%,#bfd7ff_100%)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_18px_36px_rgba(111,215,205,0.28)] transition hover:brightness-105"
    >
      {label}
    </Link>
  );
}

export function formatDateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "N/A";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
