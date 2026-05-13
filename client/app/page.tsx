"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchDashboard, type DashboardResponse } from "@/lib/api";
import {
  ErrorPanel,
  formatDateTime,
  formatDuration,
  LoadingPanel,
  MetricCard,
  NavAction,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError("");
        setData(await fetchDashboard());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Centralized Dashboard"
        title="Monitor every website from one SaaS command center."
        description="This dashboard maps directly to the product requirements: monitoring overview, historical trends, worker visibility, site status, and access to the website management and reporting layers."
        action={<NavAction href="/websites" label="Manage Websites" />}
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Websites" value={data.overview.totalWebsites} accent detail={`${data.plan?.name ?? "Plan"} workspace`} />
              <MetricCard label="Pages" value={data.overview.totalPagesMonitored} detail="Total monitored pages across all websites" />
              <MetricCard label="Active Regressions" value={data.overview.activeRegressions} detail="Critical scan outcomes in recent runs" />
              <MetricCard label="Performance Warnings" value={data.overview.performanceWarnings} detail="Recent scans with slow average load" />
              <MetricCard label="Last Scan" value={data.overview.lastScanAt ? new Date(data.overview.lastScanAt).toLocaleDateString() : "Not yet"} detail={formatDateTime(data.overview.lastScanAt)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
              <Panel strong>
                <SectionHeader
                  eyebrow="Overview"
                  title="Workspace health"
                  subtitle="The platform summary your users would expect on sign-in: coverage, recent activity, and queue-backed execution status."
                  action={<span className="tag">{data.workspace.name}</span>}
                />
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="metric-card p-4">
                    <p className="eyebrow">Plan</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{data.plan?.name ?? "Unassigned"}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {data.plan ? `${data.plan.max_websites} websites / ${data.plan.max_pages} pages` : "No plan details available"}
                    </p>
                  </div>
                  <div className="metric-card p-4">
                    <p className="eyebrow">Team Members</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{data.overview.teamMembers}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Role-ready workspace model for Owner / Admin / Viewer</p>
                  </div>
                  <div className="metric-card p-4">
                    <p className="eyebrow">Queue Depth</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{data.workerSystem.queueDepth}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Jobs waiting for worker execution</p>
                  </div>
                  <div className="metric-card p-4">
                    <p className="eyebrow">Active Workers</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {data.workerSystem.activeWorkers} / {data.workerSystem.maxWorkers}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Retry-safe queue system with timeout protection</p>
                  </div>
                </div>
              </Panel>

              <Panel>
                <SectionHeader
                  eyebrow="Historical Trend"
                  title="Recent monitoring trend"
                  subtitle="Mismatch percentage and regression counts across the latest scan runs."
                />
                {data.trend.length === 0 ? (
                  <div className="mt-6 metric-card p-4 text-sm text-[var(--muted)]">No historical scans yet. Launch a monitoring run from Scan Center.</div>
                ) : (() => {
                  const maxMismatch = Math.max(...data.trend.map((e) => e.mismatch), 0.1);
                  const maxReg = Math.max(...data.trend.map((e) => e.regressions + e.warnings), 1);
                  return (
                    <div className="mt-6 space-y-4">
                      <div className="flex items-end gap-1.5 h-28">
                        {data.trend.map((entry) => {
                          const barH = Math.max(4, Math.round((entry.mismatch / maxMismatch) * 100));
                          const color = entry.mismatch > 2 ? "bg-red-400" : entry.mismatch > 0.5 ? "bg-amber-400" : "bg-emerald-400";
                          return (
                            <div key={entry.date} className="flex-1 flex flex-col items-center gap-1 group">
                              <span className="hidden group-hover:block text-[10px] text-[var(--muted)] whitespace-nowrap">{entry.mismatch}%</span>
                              <div className={`w-full rounded-t-[6px] transition-all ${color}`} style={{ height: `${barH}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-end gap-1.5 h-20">
                        {data.trend.map((entry) => {
                          const total = entry.regressions + entry.warnings;
                          const barH = Math.max(4, Math.round((total / maxReg) * 100));
                          return (
                            <div key={`reg-${entry.date}`} className="flex-1 flex flex-col items-center gap-1 group">
                              <span className="hidden group-hover:block text-[10px] text-[var(--muted)] whitespace-nowrap">{total}</span>
                              <div className="w-full rounded-t-[6px] bg-sky-300 transition-all" style={{ height: `${barH}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-1.5">
                        {data.trend.map((entry) => (
                          <div key={`label-${entry.date}`} className="flex-1 text-center text-[9px] text-[var(--muted)] truncate">
                            {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />Mismatch % (green=low)</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-300" />Regressions + Warnings</span>
                      </div>
                    </div>
                  );
                })()}
              </Panel>
            </div>

            <Panel>
              <SectionHeader
                eyebrow="Per Website View"
                title="Monitored websites"
                subtitle="Status summary, viewport, last scan time, page coverage, and performance cues for each property."
                action={<Link href="/results" className="tag">Open Scan Center</Link>}
              />
              <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {data.websites.length === 0 ? (
                  <div className="metric-card p-5 text-sm text-[var(--muted)]">No websites configured yet. Use the Websites page to add your first property.</div>
                ) : (
                  data.websites.map((site) => (
                    <div key={site.id} className="metric-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-[var(--foreground)]">{site.displayName}</p>
                          <p className="mt-1 break-all text-xs text-[var(--muted)]">{site.url}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`tag ${site.status === "Critical" ? "border-red-200 text-red-700" : site.status === "Warning" ? "border-amber-200 text-amber-700" : site.status === "Pass" ? "border-emerald-200 text-emerald-700" : ""}`}>
                            {site.status}
                          </span>
                          <span className="tag">{site.active ? "Active" : "Paused"}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-[16px] border border-[var(--line)] bg-white/60 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Viewport</p>
                          <p className="mt-1 text-sm font-semibold capitalize text-[var(--foreground)]">{site.viewport}</p>
                        </div>
                        <div className="rounded-[16px] border border-[var(--line)] bg-white/60 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Frequency</p>
                          <p className="mt-1 text-sm font-semibold capitalize text-[var(--foreground)]">{site.monitoringFrequency}</p>
                        </div>
                        <div className={`rounded-[16px] border p-2.5 ${site.highestMismatch > 2 ? "border-red-200 bg-red-50" : site.highestMismatch > 0.3 ? "border-amber-200 bg-amber-50" : "border-[var(--line)] bg-white/60"}`}>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Mismatch</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{site.highestMismatch}%</p>
                        </div>
                        <div className={`rounded-[16px] border p-2.5 ${site.loadTimeMs !== null && site.loadTimeMs > 4000 ? "border-amber-200 bg-amber-50" : "border-[var(--line)] bg-white/60"}`}>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Avg Load</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatDuration(site.loadTimeMs)}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-[16px] border border-[var(--line)] bg-white/65 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Monitored Pages ({site.pages.length})</p>
                        <p className="mt-1.5 text-xs leading-5 text-[var(--foreground)]">{site.pages.slice(0, 6).join(" · ")}{site.pages.length > 6 ? ` +${site.pages.length - 6} more` : ""}</p>
                      </div>
                      <p className="mt-3 text-xs text-[var(--muted)]">Last scan: {formatDateTime(site.lastScanAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </main>
  );
}