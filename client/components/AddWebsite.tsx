"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportScanReport,
  exportScanReportById,
  exportScanReportCsv,
  fetchScanHistory,
  fetchScanJob,
  imageUrl,
  startWebsiteScan,
  type MonitorPageResult,
  type MonitorResponse,
  type ScanJobStatus,
  type ScanRecord
} from "@/lib/api";
import { supabase } from "@/lib/supabase";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const viewportOptions = [
  { value: "desktop", label: "Desktop", hint: "1440 x 900 capture profile" },
  { value: "mobile", label: "Mobile", hint: "390 x 844 responsive probe" }
] as const;

const frequencyOptions = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" }
] as const;

const scanCapabilityCards = [
  { label: "Visual Diff", detail: "Baseline, current, and highlighted regression output" },
  { label: "DOM Diff", detail: "Selector-level structural and content change detection" },
  { label: "Smoke Checks", detail: "Broken links, errors, forms, flows, and response health" },
  { label: "GitHub Audit", detail: "Optional repository drift review alongside page scans" }
];

const formatDuration = (ms: number | null) => {
  if (ms === null) return "N/A";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

function fallbackFunctionalRegression(pageUrl = "") {
  return {
    pageUrl,
    responseCode: null,
    loadTimeMs: null,
    testedAt: "",
    status: "Not captured",
    coreElements: [],
    missingCoreElements: [],
    consoleErrors: [],
    brokenLinks: [],
    form: {
      available: false,
      count: 0,
      interactiveControlCount: 0,
      requiredFieldCount: 0,
      semanticValidationCount: 0,
      formWithSubmitCount: 0
    },
    flow: {
      attempted: false,
      passed: true,
      step: null,
      targetUrl: null,
      details: "Functional data was not captured for this scan."
    },
    requestFailures: [],
    checks: [],
    checkSummary: {
      passed: 0,
      warning: 0,
      failed: 0,
      skipped: 0
    },
    metrics: {
      internalLinksChecked: 0,
      navLinksChecked: 0,
      buttonTargetsChecked: 0,
      formsDetected: 0,
      authArtifactsDetected: 0,
      searchArtifactsDetected: 0,
      apiFailures: 0,
      cookiesObserved: 0,
      fileInputsDetected: 0,
      downloadLinksDetected: 0
    }
  };
}

function getFunctionalRegression(page: Pick<MonitorPageResult, "url"> & Partial<MonitorPageResult>) {
  return page.functionalRegression ?? fallbackFunctionalRegression(page.url);
}

const hasIssue = (page: MonitorPageResult) =>
  (page.visualRegression?.mismatchPercentage ?? 0) > 0 ||
  (page.domRegression?.summary?.total ?? 0) > 0 ||
  getFunctionalRegression(page).status !== "Healthy";

const functionalTone = (status: string) =>
  status === "Failed"
    ? "border-red-200 bg-red-50 text-red-900"
    : status === "Warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : status === "Passed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-[var(--line)] bg-white/70 text-[var(--foreground)]";

function Card({
  children,
  className = "",
  strong = false
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <section
      className={cx(
        strong ? "panel-strong" : "panel",
        "rounded-[30px] p-5 shadow-[0_24px_70px_rgba(18,24,31,0.08)] sm:p-6",
        className
      )}
    >
      {children}
    </section>
  );
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
      {subtitle ? <p className="max-w-2xl text-xs leading-5 text-[var(--muted)]">{subtitle}</p> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[22px] border p-4",
        accent ? "bg-[rgba(154,242,208,0.26)] border-emerald-200" : "metric-card"
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="overflow-hidden rounded-full border border-[var(--line)] bg-[rgba(16,20,26,0.05)]">
      <div
        className="h-3 rounded-full bg-[linear-gradient(90deg,#9af2d0_0%,#73d9d4_45%,#b5d4ff_100%)] transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  );
}

function IssueCard({
  page,
  selected,
  onSelect
}: {
  page: MonitorPageResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "w-full rounded-[24px] border p-4 text-left transition",
        selected
          ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(154,242,208,0.32),rgba(181,212,255,0.24))] shadow-[0_18px_40px_rgba(18,24,31,0.06)]"
          : "border-[var(--line)] bg-white/65 hover:bg-white/82"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{page.path}</p>
          <p className="mt-1 break-all text-xs text-[var(--muted)]">{page.url}</p>
        </div>
        <span className="tag">Open</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Stat label="Mismatch" value={`${page.visualRegression.mismatchPercentage}%`} />
        <Stat label="DOM" value={page.domRegression.summary.total} />
        <Stat label="Functional" value={getFunctionalRegression(page).status} />
      </div>
    </button>
  );
}

function ScanHistory({
  scans,
  onExport,
  exportingId
}: {
  scans: ScanRecord[];
  onExport: (scanId: number) => void;
  exportingId: number | null;
}) {
  return (
    <Card>
      <div className="space-y-4">
        <Header
          eyebrow=""
          title="History"
        />
        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {scans.length === 0 ? (
            <div className="metric-card p-4 text-sm text-[var(--muted)]">Empty</div>
          ) : (
            scans.map((scan) => (
              <div key={scan.id} className="metric-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">#{scan.id}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{scan.visual_mismatch_percentage}%</p>
                  </div>
                  <button
                    onClick={() => onExport(scan.id)}
                    disabled={exportingId === scan.id}
                    className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[rgba(154,242,208,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportingId === scan.id ? "..." : "PDF"}
                  </button>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">{new Date(scan.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function DetailView({
  page,
  history,
  sliderValue
}: {
  page: MonitorPageResult;
  history: ScanRecord[];
  sliderValue: number;
}) {
  const baselineImage = imageUrl(page.visualRegression.baselineImageUrl) ?? "";
  const currentImage = imageUrl(page.visualRegression.currentImageUrl) ?? "";
  const diffImage = imageUrl(page.visualRegression.diffImageUrl);
  const functional = getFunctionalRegression(page);
  const functionalChecks = functional.checks ?? [];
  const timeline = history
    .map((scan) => {
      const current = scan.report_payload?.pageResults?.find((entry) => entry.path === page.path);
      if (!current) return null;
      return {
        scanId: scan.id,
        createdAt: scan.created_at,
        mismatch: current.visualRegression.mismatchPercentage,
        dom: current.domRegression.summary.total,
        functional: getFunctionalRegression(current).status
      };
    })
    .filter(Boolean) as Array<{
    scanId: number;
    createdAt: string;
    mismatch: number;
    dom: number;
    functional: string;
  }>;

  return (
    <Card strong>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="eyebrow">Detail</p>
          <h4 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{page.path}</h4>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Stat label="Mismatch %" value={page.visualRegression.mismatchPercentage} accent />
          <Stat label="Visual" value={page.visualRegression.status} />
          <Stat label="Load Time" value={formatDuration(functional.loadTimeMs)} />
          <Stat label="HTTP" value={functional.responseCode ?? "N/A"} />
          <Stat label="DOM Total" value={page.domRegression.summary.total} />
          <Stat label="Functional" value={functional.status} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="metric-card rounded-[24px] p-3">
                <p className="eyebrow mb-2">Base</p>
                <img src={baselineImage} alt={`Baseline screenshot for ${page.path}`} className="w-full rounded-[18px] border border-[var(--line)]" />
              </div>
              <div className="metric-card rounded-[24px] p-3">
                <p className="eyebrow mb-2">Now</p>
                <img src={currentImage} alt={`Current screenshot for ${page.path}`} className="w-full rounded-[18px] border border-[var(--line)]" />
              </div>
            </div>

            <div className="metric-card overflow-hidden rounded-[26px] p-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-[rgba(16,20,26,0.04)]">
                <img src={baselineImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${sliderValue}%` }}>
                  <img src={currentImage} alt="" className="h-full w-full object-cover" />
                </div>
                <div
                  className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)]"
                  style={{ left: `${sliderValue}%` }}
                />
              </div>
            </div>
          </div>

          <div className="metric-card rounded-[26px] p-3">
            <p className="eyebrow mb-2">Diff</p>
            {diffImage ? (
              <img src={diffImage} alt={`Diff screenshot for ${page.path}`} className="w-full rounded-[20px] border border-[var(--line)]" />
            ) : (
              <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[rgba(16,20,26,0.03)] p-10 text-sm text-[var(--muted)]">
                No diff
              </div>
            )}
          </div>
        </div>

        <div className="metric-card rounded-[24px] p-5">
          <h5 className="text-lg font-semibold text-[var(--foreground)]">DOM Changes</h5>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <Stat label="Added" value={page.domRegression.summary.added} />
            <Stat label="Removed" value={page.domRegression.summary.removed} />
            <Stat label="Attr Changed" value={page.domRegression.summary.attributeChanged} />
            <Stat label="Text Changed" value={page.domRegression.summary.textChanged} />
            <Stat label="Severity" value={page.domRegression.summary.severity} />
          </div>
          {page.domRegression.changedSelectors.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Changed Selectors</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {page.domRegression.changedSelectors.slice(0, 20).map((sel, i) => (
                  <code key={`${page.pageId}-sel-${i}`} className="rounded-[12px] border border-[var(--line)] bg-[rgba(16,20,26,0.04)] px-2 py-1 text-xs text-[var(--foreground)]">
                    {sel}
                  </code>
                ))}
              </div>
            </div>
          ) : null}
          {page.domRegression.diffLog.length > 0 ? (
            <div className="mt-4 max-h-64 space-y-2 overflow-auto">
              <p className="text-sm font-semibold text-[var(--foreground)]">Diff Log</p>
              {page.domRegression.diffLog.slice(0, 30).map((entry, i) => {
                const tone =
                  entry.type === "removed"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : entry.type === "added"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900";
                return (
                  <div key={`${page.pageId}-diff-${i}`} className={cx("rounded-[16px] border p-3", tone)}>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-semibold break-all">{entry.selector}</code>
                      <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {entry.type}
                      </span>
                    </div>
                    {(entry.oldText || entry.newText) ? (
                      <p className="mt-1 text-xs opacity-80 break-all">
                        {entry.oldText ? `"${entry.oldText}"` : ""}
                        {entry.oldText && entry.newText ? " → " : ""}
                        {entry.newText ? `"${entry.newText}"` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : page.domRegression.summary.total === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">No DOM changes detected.</p>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="metric-card rounded-[24px] p-5">
            <h5 className="text-lg font-semibold text-[var(--foreground)]">Timeline</h5>
            <div className="mt-4 space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Empty</p>
              ) : (
                timeline.map((entry) => (
                  <div key={entry.scanId} className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">#{entry.scanId}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{new Date(entry.createdAt).toLocaleDateString()}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {entry.mismatch}% / {entry.dom} / {entry.functional}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="metric-card rounded-[24px] p-5">
            <h5 className="text-lg font-semibold text-[var(--foreground)]">Checks</h5>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Broken Links" value={functional.brokenLinks.length} />
              <Stat label="Console" value={functional.consoleErrors.length} />
              <Stat label="Forms" value={functional.form.count} />
              <Stat label="Flow" value={functional.flow.attempted ? (functional.flow.passed ? "Pass" : "Fail") : "Skip"} />
              <Stat label="Checks Passed" value={functional.checkSummary?.passed ?? 0} />
              <Stat label="Warnings" value={functional.checkSummary?.warning ?? 0} />
              <Stat label="Checks Failed" value={functional.checkSummary?.failed ?? 0} />
              <Stat label="Skipped" value={functional.checkSummary?.skipped ?? 0} />
            </div>

            <div className="mt-4 space-y-3">
              {functionalChecks.length > 0 ? (
                functionalChecks.map((check) => (
                  <div key={`${page.pageId}-${check.id}`} className={cx("rounded-[20px] border p-4", functionalTone(check.status))}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{check.label}</p>
                      <span className="rounded-full border border-current/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm opacity-90">{check.summary}</p>
                    {check.findings.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {check.findings.map((finding, index) => (
                          <p key={`${page.pageId}-${check.id}-${index}`} className="text-xs leading-5 opacity-80">
                            {finding}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Empty</p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {functional.consoleErrors.length > 0 ? (
                functional.consoleErrors.map((error, index) => (
                  <pre
                    key={`${page.pageId}-console-${index}`}
                    className="overflow-auto rounded-[20px] border border-red-200 bg-red-50 p-3 text-xs text-red-900"
                  >
                    {error}
                  </pre>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Clear</p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">Links</p>
              {functional.brokenLinks.length > 0 ? (
                functional.brokenLinks.map((link, index) => (
                  <div key={`${page.pageId}-broken-link-${index}`} className="rounded-[20px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="break-all font-medium">{link.url}</p>
                    <p className="mt-1 text-xs text-amber-900/75">
                      {link.statusCode ?? "No response"}{link.error ? ` / ${link.error}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Clear</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AddWebsite() {
  const [url, setUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [enableSmokeTests, setEnableSmokeTests] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [monitoringFrequency, setMonitoringFrequency] = useState("daily");
  const [thresholdPercentage, setThresholdPercentage] = useState("0.3");
  const [ignoredSelectorsInput, setIgnoredSelectorsInput] = useState("");
  const [criticalElementsInput, setCriticalElementsInput] = useState("");
  const [result, setResult] = useState<MonitorResponse | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [job, setJob] = useState<ScanJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingScanId, setExportingScanId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(50);
  const pollingRef = useRef<number | null>(null);
  const pollingFailureCountRef = useRef(0);

  useEffect(() => () => {
    if (pollingRef.current) window.clearTimeout(pollingRef.current);
  }, []);

  useEffect(() => {
    const websiteId = result?.websiteId ?? job?.websiteId;
    if (!websiteId) return;
    const channel = supabase
      .channel(`scan-history-${websiteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scans", filter: `website_id=eq.${websiteId}` },
        (payload: { new: unknown }) => {
          setHistory((prev) => [payload.new as ScanRecord, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.websiteId, result?.websiteId]);

  const issuePages = useMemo(() => result?.pageResults.filter(hasIssue) ?? [], [result]);
  const selectedPage = useMemo(
    () => issuePages.find((page) => page.pageId === selectedPageId) ?? issuePages[0] ?? null,
    [issuePages, selectedPageId]
  );

  useEffect(() => {
    setSelectedPageId(issuePages[0]?.pageId ?? null);
  }, [result, issuePages]);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollJob = async (jobId: string) => {
    try {
      const nextJob = await fetchScanJob(jobId);
      pollingFailureCountRef.current = 0;
      setJob(nextJob);

      if (nextJob.status === "completed" && nextJob.result) {
        stopPolling();
        setResult(nextJob.result);
        setLoading(false);
        setHistory(await fetchScanHistory(nextJob.result.websiteId));
        return;
      }

      if (nextJob.status === "failed") {
        stopPolling();
        setLoading(false);
        setError(nextJob.error || "Scan failed.");
        return;
      }

      pollingRef.current = window.setTimeout(() => void pollJob(jobId), 1000);
    } catch (pollError) {
      pollingFailureCountRef.current += 1;
      if (pollingFailureCountRef.current >= 10) {
        stopPolling();
        setLoading(false);
        setError(pollError instanceof Error ? pollError.message : "Failed to fetch scan progress.");
        return;
      }
      pollingRef.current = window.setTimeout(() => void pollJob(jobId), 1500);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleScan = async () => {
    stopPolling();
    setLoading(true);
    setError("");
    setResult(null);
    setHistory([]);
    setJob(null);
    setSelectedPageId(null);
    pollingFailureCountRef.current = 0;

    try {
      const { jobId } = await startWebsiteScan({
        url,
        ...(githubUrl.trim() ? { githubUrl } : {}),
        enableSmokeTests,
        viewport,
        monitoringFrequency,
        thresholdPercentage: Number(thresholdPercentage),
        ignoredSelectors: ignoredSelectorsInput
          .split("\n")
          .map((selector) => selector.trim())
          .filter(Boolean),
        criticalElements: criticalElementsInput
          .split("\n")
          .map((selector) => selector.trim())
          .filter(Boolean)
      });
      await pollJob(jobId);
    } catch (scanError) {
      stopPolling();
      setLoading(false);
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    }
  };

  const handleExport = async () => {
    if (!result || exporting) return;
    setExporting(true);
    setError("");
    try {
      downloadBlob(await exportScanReport(result), `scan-report-${result.websiteId}.pdf`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export report.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!result?.scanId || exportingCsv) return;
    setExportingCsv(true);
    setError("");
    try {
      downloadBlob(await exportScanReportCsv(result.scanId), `scan-report-${result.websiteId}.csv`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export CSV report.");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportScan = async (scanId: number) => {
    if (exportingScanId) return;
    setExportingScanId(scanId);
    setError("");
    try {
      downloadBlob(await exportScanReportById(scanId), `scan-report-${scanId}.pdf`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export report.");
    } finally {
      setExportingScanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card strong className="reveal-up">
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-5">
            <Header
              eyebrow="Scan Workspace"
              title="Create a Monitored Website Run"
              subtitle="Configure the target, choose the viewport, tune the visual sensitivity, and launch a complete regression pass."
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Website URL</span>
              <input
                className="w-full rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-emerald-300 focus:bg-white"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">GitHub Repository</span>
              <input
                className="w-full rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-sky-300 focus:bg-white"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <p className="text-xs leading-5 text-[var(--muted)]">Optional. Adds repository drift analysis next to the live website scan.</p>
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-white/65 p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Viewport Profile</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Choose the primary rendering mode for screenshots and smoke checks.</p>
                </div>
                <div className="grid gap-3">
                  {viewportOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setViewport(option.value)}
                      className={cx(
                        "rounded-[20px] border p-4 text-left transition",
                        viewport === option.value
                          ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(154,242,208,0.28),rgba(181,212,255,0.18))]"
                          : "border-[var(--line)] bg-white/70 hover:bg-white"
                      )}
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">{option.label}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{option.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-white/65 p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Visual Threshold</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Pass up to this mismatch percentage before escalating the page.</p>
                </div>
                <div className="metric-card rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow">Tolerance</span>
                    <span className="text-lg font-semibold text-[var(--foreground)]">{thresholdPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={thresholdPercentage}
                    onChange={(e) => setThresholdPercentage(e.target.value)}
                    className="mt-4 w-full accent-[var(--accent-strong)]"
                  />
                </div>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Ignored CSS Selectors</span>
              <textarea
                className="min-h-28 w-full rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-emerald-300 focus:bg-white"
                placeholder=".cookie-banner&#10;.live-chat-widget&#10;[data-timestamp]"
                value={ignoredSelectorsInput}
                onChange={(e) => setIgnoredSelectorsInput(e.target.value)}
              />
              <p className="text-xs leading-5 text-[var(--muted)]">One selector per line. Use this for unstable UI such as banners, timestamps, or rotating widgets.</p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Critical Elements (Required)</span>
              <textarea
                className="min-h-28 w-full rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-red-300 focus:bg-white"
                placeholder="#main-nav&#10;.footer-contact&#10;button[type='submit']"
                value={criticalElementsInput}
                onChange={(e) => setCriticalElementsInput(e.target.value)}
              />
              <p className="text-xs leading-5 text-[var(--muted)]">One selector per line. The scan will mark a <b>Functional Failure</b> if these elements are missing.</p>
            </label>

            <label className="rounded-[24px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(154,242,208,0.22),rgba(255,255,255,0.7))] p-4">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={enableSmokeTests}
                  onChange={(e) => setEnableSmokeTests(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--line)] bg-transparent text-[var(--accent-strong)] focus:ring-[var(--accent-strong)]"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Enable Functional & Smoke Testing</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Runs response, broken-link, form, console, compatibility, and safe representative flow checks.</p>
                </div>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleScan}
                disabled={loading || !url}
                className="rounded-full bg-[linear-gradient(90deg,#9af2d0_0%,#6fd7cd_45%,#bfd7ff_100%)] px-6 py-3 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_18px_36px_rgba(111,215,205,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Launching..." : "Start Monitoring Run"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {scanCapabilityCards.map((card, index) => (
              <div key={card.label} className={cx("metric-card rounded-[24px] p-4", index === 0 && "bg-[rgba(154,242,208,0.26)] border-emerald-200")}>
                <p className="eyebrow">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{card.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {job ? (
        <Card className="reveal-up reveal-delay-1">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Header
                eyebrow="Live"
                title="Running"
              />
              <div className="tag">{job.progressPercentage}%</div>
            </div>
            <ProgressBar progress={job.progressPercentage} />
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Status" value={job.message} />
              <Stat label="Pages" value={`${job.completedPages} / ${job.totalPages || "?"}`} />
              <div className="metric-card p-4">
                <p className="eyebrow">Current</p>
                <p className="mt-2 break-all text-sm text-[var(--foreground)]">{job.currentPageUrl ?? "..."}</p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 reveal-up">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6 reveal-up reveal-delay-2">
          <Card strong>
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Result</p>
                  <h3 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{result.siteName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[rgba(154,242,208,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting ? "..." : "PDF"}
                  </button>
                  {result.scanId ? (
                    <button
                      onClick={handleExportCsv}
                      disabled={exportingCsv}
                      className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[rgba(154,242,208,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exportingCsv ? "..." : "CSV"}
                    </button>
                  ) : null}
                </div>
              </div>

                <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <Header eyebrow="" title="Summary" />
                  <div className="grid gap-3 md:grid-cols-3">
                    <Stat label="Pages" value={result.summary.totalPages} accent />
                    <Stat label="New Pages" value={result.summary.newPages} />
                    <Stat label="Visual Changes" value={result.summary.pagesWithVisualChanges} />
                    <Stat label="DOM Changes" value={result.summary.pagesWithDomChanges} />
                    <Stat label="Max Mismatch" value={`${result.summary.highestVisualMismatch}%`} />
                    <Stat label="Overall" value={result.summary.overallStatus} />
                  </div>
                </div>

                <div className="metric-card rounded-[24px] p-5">
                  <p className="eyebrow">Run Config</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Viewport</span><span className="font-semibold capitalize text-[var(--foreground)]">{result.websiteConfig.viewport}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Threshold</span><span className="font-semibold text-[var(--foreground)]">{result.websiteConfig.thresholdPercentage}%</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Ignored</span><span className="font-semibold text-[var(--foreground)]">{result.websiteConfig.ignoredSelectors.length}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Smoke</span><span className="font-semibold text-[var(--foreground)]">{result.smokeTestingEnabled ? "Enabled" : "Disabled"}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Functional Status</span><span className="font-semibold text-[var(--foreground)]">{result.functionalSummary.overallStatus}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Average Load</span><span className="font-semibold text-[var(--foreground)]">{formatDuration(result.functionalSummary.averageLoadTimeMs)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {result.codeRegression ? (
            <Card>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Header eyebrow="" title="Repository Drift" subtitle="Code changes detected between the saved repository baseline and the current reference." />
                  <span className="tag">{result.codeRegression.branch}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  <Stat label="Changed Files" value={result.codeRegression.summary.totalChangedFiles} accent />
                  <Stat label="Added" value={result.codeRegression.summary.added} />
                  <Stat label="Removed" value={result.codeRegression.summary.removed} />
                  <Stat label="Modified" value={result.codeRegression.summary.modified} />
                  <Stat label="Renamed" value={result.codeRegression.summary.renamed} />
                </div>
                <div className="grid gap-3">
                  {result.codeRegression.changedFiles.slice(0, 8).map((file) => (
                    <div key={`${file.path}-${file.status}`} className="metric-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold text-[var(--foreground)]">{file.path}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{file.status} · +{file.additions} / -{file.deletions}</p>
                        </div>
                        <span className="tag">{file.changes} changes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[350px,1fr]">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Header eyebrow="" title="Issues" />
                  <span className="tag">{issuePages.length}</span>
                </div>
                {issuePages.length === 0 ? (
                  <div className="metric-card rounded-[24px] p-4 text-sm text-[var(--muted)]">Clear</div>
                ) : (
                  <div className="space-y-3">
                    {issuePages.map((page) => (
                      <IssueCard
                        key={page.pageId}
                        page={page}
                        selected={selectedPage?.pageId === page.pageId}
                        onSelect={() => setSelectedPageId(page.pageId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Header eyebrow="" title="Compare" />
                  <div className="tag">{sliderValue}%</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  className="mt-5 w-full accent-[var(--accent-strong)]"
                />
              </Card>
              {selectedPage ? <DetailView page={selectedPage} history={history} sliderValue={sliderValue} /> : null}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <Card>
              <div className="space-y-4">
                <Header eyebrow="" title="System" />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Stat label="Active" value={result.workerSystem.activeWorkers} />
                  <Stat label="Max Workers" value={result.workerSystem.maxWorkers} />
                  <Stat label="Queue Depth" value={result.workerSystem.queueDepth} />
                  <Stat label="Retries" value={result.workerSystem.retryLimit} />
                  <Stat label="Timeout" value={formatDuration(result.workerSystem.timeoutMs)} />
                  <Stat label="Auto Scale" value={result.workerSystem.autoScaling ? "On" : "Off"} accent />
                </div>
              </div>
            </Card>

            <ScanHistory scans={history} onExport={handleExportScan} exportingId={exportingScanId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
