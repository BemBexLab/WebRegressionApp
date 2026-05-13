"use client";

import { useEffect, useState } from "react";
import { fetchAdmin, type AdminResponse } from "@/lib/api";
import {
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

export default function AdminPage() {
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setData(await fetchAdmin());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load admin overview.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Admin Panel"
        title="Observe platform load, job activity, and feature state."
        description="This page brings the admin requirements into the product shell: global stats, job pipeline visibility, and feature flag control surfaces."
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel label="Loading admin data..." /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Users" value={data.globalStats.totalUsers} accent />
              <MetricCard label="Workspaces" value={data.globalStats.totalWorkspaces} />
              <MetricCard label="Websites" value={data.globalStats.totalWebsites} />
              <MetricCard label="Scans" value={data.globalStats.totalScans} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
              <Panel strong>
                <SectionHeader eyebrow="System Load" title="Worker engine telemetry" subtitle="Distributed-ready queue execution and throughput visibility." />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Queue Depth" value={data.workerSystem.queueDepth} />
                  <MetricCard label="Active Workers" value={data.workerSystem.activeWorkers} />
                  <MetricCard label="Max Workers" value={data.workerSystem.maxWorkers} />
                  <MetricCard label="Retry Limit" value={data.workerSystem.retryLimit} />
                  <MetricCard label="Timeout" value={`${Math.round(data.workerSystem.timeoutMs / 1000)}s`} />
                  <MetricCard label="Auto Scaling" value={data.workerSystem.autoScaling ? "On" : "Off"} />
                </div>
              </Panel>

              <Panel>
                <SectionHeader eyebrow="Feature Flags" title="Platform controls" subtitle="Admin-facing switches for phased features and enterprise options." />
                <div className="mt-6 grid gap-3">
                  {data.featureFlags.map((flag) => (
                    <div key={flag.key} className="metric-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{flag.label}</p>
                        <span className="tag">{flag.enabled ? "Enabled" : "Planned"}</span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{flag.scope}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel>
              <SectionHeader eyebrow="Recent Jobs" title="Execution history" subtitle="Latest job-level activity for scans and worker orchestration." />
              <div className="mt-6 space-y-3">
                {data.recentJobs.map((job) => (
                  <div key={job.job_id} className="metric-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{job.site_name || "Queued scan"}</p>
                      <span className="tag">{job.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {job.completed_pages} / {job.total_pages || "?"} pages · {job.progress_percentage}% · {new Date(job.updated_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">{job.message}</p>
                    {job.error ? <p className="mt-2 text-xs text-red-700">{job.error}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </main>
  );
}
