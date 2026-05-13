"use client";

import { useEffect, useState } from "react";
import { fetchAlerts, type AlertsResponse } from "@/lib/api";
import {
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setData(await fetchAlerts());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load alerts.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Alerting System"
        title="Track incidents and route notifications across channels."
        description="Email, Slack, and Webhook channels are surfaced now, with WhatsApp and SMS clearly represented as later-phase product expansion."
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel label="Loading alert configuration..." /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Configured Channels" value={data.channels.length} accent />
              <MetricCard label="Supported Triggers" value={data.triggers.length} />
              <MetricCard label="Open Incidents" value={data.incidents.length} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
              <Panel>
                <SectionHeader eyebrow="Channels" title="Delivery channels" subtitle="Where alerts are sent when regressions or runtime failures are detected." />
                <div className="mt-6 space-y-3">
                  {data.channels.map((channel) => (
                    <div key={channel.id} className="metric-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold capitalize text-[var(--foreground)]">{channel.name}</p>
                        <span className="tag">{channel.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{channel.type} · {channel.target}</p>
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Triggers: {channel.triggers.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel strong>
                <SectionHeader eyebrow="Incidents" title="Recent alert-worthy events" subtitle="Visual, functional, and link-related events gathered from the latest scan results." />
                <div className="mt-6 space-y-3">
                  {data.incidents.length === 0 ? (
                    <div className="metric-card p-4 text-sm text-[var(--muted)]">No active alert incidents detected in recent scans.</div>
                  ) : (
                    data.incidents.map((incident) => (
                      <div key={incident.id} className="metric-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{incident.websiteName}</p>
                          <span className="tag">{incident.severity}</span>
                        </div>
                        <p className="mt-2 text-sm capitalize text-[var(--foreground)]">{incident.type.replace("-", " ")}</p>
                        <p className="mt-1 break-all text-xs text-[var(--muted)]">{incident.pageUrl || "Website-level event"}</p>
                        <p className="mt-2 text-xs text-[var(--muted)]">{new Date(incident.timestamp).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>

            <Panel>
              <SectionHeader eyebrow="Triggers" title="Alert rules" subtitle="Requirement-driven triggers for visual, availability, runtime, and performance signals." />
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {data.triggers.map((trigger) => (
                  <div key={trigger} className="metric-card p-4 text-sm text-[var(--foreground)]">
                    {trigger}
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
