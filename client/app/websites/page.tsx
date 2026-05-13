"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createWebsite,
  deleteWebsite,
  fetchWebsiteDetail,
  fetchWebsites,
  updateWebsite,
  type WebsitePayload,
  type WebsiteRecord,
  type WebsiteDetailResponse
} from "@/lib/api";
import {
  ErrorPanel,
  formatDateTime,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

const initialForm: WebsitePayload = {
  url: "",
  displayName: "",
  githubUrl: "",
  viewport: "desktop",
  monitoringFrequency: "daily",
  thresholdPercentage: 0.3,
  loadTimeThresholdMs: 4000,
  ignoredSelectors: [],
  criticalElements: [],
  monitoredPages: ["/"],
  alertChannels: ["email", "slack"],
  active: true
};

function toTextareaLines(items: string[]) {
  return items.join("\n");
}

function fromTextareaLines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<WebsiteRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WebsiteDetailResponse | null>(null);
  const [form, setForm] = useState<WebsitePayload>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadWebsites();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    void (async () => {
      try {
        setError("");
        const nextDetail = await fetchWebsiteDetail(selectedId);
        setDetail(nextDetail);
        setForm({
          url: nextDetail.website.url,
          displayName: nextDetail.website.display_name || "",
          githubUrl: nextDetail.website.github_url || "",
          viewport: nextDetail.website.viewport,
          monitoringFrequency: nextDetail.website.monitoring_frequency,
          thresholdPercentage: nextDetail.website.threshold_percentage,
          loadTimeThresholdMs: nextDetail.website.load_time_threshold_ms,
          ignoredSelectors: nextDetail.website.ignored_selectors || [],
          criticalElements: nextDetail.website.critical_elements || [],
          monitoredPages: nextDetail.website.monitored_pages?.length ? nextDetail.website.monitored_pages : ["/"],
          alertChannels: nextDetail.website.alert_channels || [],
          active: nextDetail.website.active
        });
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : "Failed to load website detail.");
      }
    })();
  }, [selectedId]);

  async function loadWebsites() {
    try {
      setLoading(true);
      setError("");
      const list = await fetchWebsites();
      setWebsites(list);
      if (!selectedId && list[0]) {
        setSelectedId(list[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load websites.");
    } finally {
      setLoading(false);
    }
  }

  const selectedWebsite = useMemo(
    () => websites.find((website) => website.id === selectedId) ?? null,
    [selectedId, websites]
  );

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        ignoredSelectors: form.ignoredSelectors,
        criticalElements: form.criticalElements,
        monitoredPages: form.monitoredPages,
        alertChannels: form.alertChannels
      };

      if (selectedId) {
        const updated = await updateWebsite(selectedId, payload);
        setWebsites((prev) => prev.map((website) => (website.id === updated.id ? updated : website)));
      } else {
        const created = await createWebsite(payload);
        setWebsites((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save website.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const site = websites.find((w) => w.id === selectedId);
    const name = site?.display_name || site?.site_key || "this website";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      setDeleting(true);
      setError("");
      await deleteWebsite(selectedId);
      setWebsites((prev) => prev.filter((w) => w.id !== selectedId));
      setSelectedId(null);
      setDetail(null);
      setForm(initialForm);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete website.");
    } finally {
      setDeleting(false);
    }
  }

  function startNew() {
    setSelectedId(null);
    setDetail(null);
    setForm(initialForm);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Website Management Panel"
        title="Configure monitored websites, pages, thresholds, and critical elements."
        description="This section implements the management layer from the requirements: multiple websites, multiple pages, monitoring frequency, ignored selectors, critical elements, and per-site settings."
        action={
          <button
            type="button"
            onClick={startNew}
            className="rounded-full bg-[linear-gradient(90deg,#9af2d0_0%,#6fd7cd_45%,#bfd7ff_100%)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_18px_36px_rgba(111,215,205,0.28)]"
          >
            Add Website
          </button>
        }
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel label="Loading website inventory..." /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
          <Panel>
            <SectionHeader eyebrow="Inventory" title="Configured websites" subtitle="Select a website to edit its monitoring profile." />
            <div className="mt-6 space-y-3">
              {websites.length === 0 ? (
                <div className="metric-card p-4 text-sm text-[var(--muted)]">No websites created yet.</div>
              ) : (
                websites.map((website) => (
                  <button
                    key={website.id}
                    type="button"
                    onClick={() => setSelectedId(website.id)}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      selectedId === website.id
                        ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(154,242,208,0.28),rgba(181,212,255,0.18))]"
                        : "border-[var(--line)] bg-white/70 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{website.display_name || website.site_key}</p>
                      <span className="tag">{website.active ? "Active" : "Paused"}</span>
                    </div>
                    <p className="mt-2 break-all text-xs text-[var(--muted)]">{website.url}</p>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {website.monitoring_frequency} · {website.viewport} · threshold {website.threshold_percentage}%
                    </p>
                  </button>
                ))
              )}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel strong>
              <SectionHeader
                eyebrow={selectedWebsite ? "Edit Website" : "Create Website"}
                title={selectedWebsite ? selectedWebsite.display_name || selectedWebsite.site_key : "New website profile"}
                subtitle="Define how this website should be monitored and what the platform should treat as critical."
              />

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Display Name</span>
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder="Acme Marketing Site"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Website URL</span>
                  <input
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder="https://example.com"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">GitHub Repository</span>
                  <input
                    value={form.githubUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, githubUrl: e.target.value }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder="https://github.com/owner/repo"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Monitoring Frequency</span>
                  <select
                    value={form.monitoringFrequency}
                    onChange={(e) => setForm((prev) => ({ ...prev, monitoringFrequency: e.target.value }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Viewport</span>
                  <select
                    value={form.viewport}
                    onChange={(e) => setForm((prev) => ({ ...prev, viewport: e.target.value as "desktop" | "mobile" }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  >
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Visual Threshold %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.thresholdPercentage}
                    onChange={(e) => setForm((prev) => ({ ...prev, thresholdPercentage: Number(e.target.value) }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Load Time Threshold (ms)</span>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={form.loadTimeThresholdMs}
                    onChange={(e) => setForm((prev) => ({ ...prev, loadTimeThresholdMs: Number(e.target.value) }))}
                    className="w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Monitored Pages</span>
                  <textarea
                    value={toTextareaLines(form.monitoredPages)}
                    onChange={(e) => setForm((prev) => ({ ...prev, monitoredPages: fromTextareaLines(e.target.value) }))}
                    className="min-h-32 w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder={"/\n/pricing\n/contact"}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Ignored Selectors</span>
                  <textarea
                    value={toTextareaLines(form.ignoredSelectors)}
                    onChange={(e) => setForm((prev) => ({ ...prev, ignoredSelectors: fromTextareaLines(e.target.value) }))}
                    className="min-h-32 w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder={".cookie-banner\n.live-chat-widget"}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Critical Elements</span>
                  <textarea
                    value={toTextareaLines(form.criticalElements)}
                    onChange={(e) => setForm((prev) => ({ ...prev, criticalElements: fromTextareaLines(e.target.value) }))}
                    className="min-h-32 w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder={"main\nheader\n[data-test='checkout-button']"}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Alert Channels</span>
                  <textarea
                    value={toTextareaLines(form.alertChannels)}
                    onChange={(e) => setForm((prev) => ({ ...prev, alertChannels: fromTextareaLines(e.target.value) }))}
                    className="min-h-32 w-full rounded-[20px] border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                    placeholder={"email\nslack\nwebhook"}
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || !form.url}
                  className="rounded-full bg-[linear-gradient(90deg,#9af2d0_0%,#6fd7cd_45%,#bfd7ff_100%)] px-6 py-3 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_18px_36px_rgba(111,215,205,0.28)] disabled:opacity-60"
                >
                  {saving ? "Saving..." : selectedId ? "Save Website" : "Create Website"}
                </button>
                {selectedId ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-full border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Website"}
                  </button>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  Active monitoring
                </label>
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Websites" value={websites.length} accent detail="Properties configured in this workspace" />
              <MetricCard label="Selected Site" value={selectedWebsite ? "Loaded" : "New"} detail={selectedWebsite ? formatDateTime(selectedWebsite.updated_at) : "Create a fresh profile"} />
              <MetricCard label="Recent Scans" value={detail?.scans.length ?? 0} detail="Latest stored executions for the selected site" />
            </div>

            {detail ? (
              <Panel>
                <SectionHeader eyebrow="Recent Scans" title="Website activity" subtitle="Last scan history for the selected website." />
                <div className="mt-6 space-y-3">
                  {detail.scans.length === 0 ? (
                    <div className="metric-card p-4 text-sm text-[var(--muted)]">No scans recorded yet for this website.</div>
                  ) : (
                    detail.scans.map((scan) => (
                      <div key={scan.id} className="metric-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">Scan #{scan.id}</p>
                          <span className="tag">{scan.visual_status}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Mismatch {scan.visual_mismatch_percentage}% · {new Date(scan.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
