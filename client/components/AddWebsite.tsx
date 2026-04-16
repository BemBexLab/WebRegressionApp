"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportScanReport,
  exportScanReportById,
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
      interactiveControlCount: 0
    },
    flow: {
      attempted: false,
      passed: true,
      step: null,
      targetUrl: null,
      details: "Functional data was not captured for this scan."
    },
    requestFailures: []
  };
}

function getFunctionalRegression(page: Pick<MonitorPageResult, "url"> & Partial<MonitorPageResult>) {
  return page.functionalRegression ?? fallbackFunctionalRegression(page.url);
}

const hasIssue = (page: MonitorPageResult) =>
  (page.visualRegression?.mismatchPercentage ?? 0) > 0 ||
  (page.domRegression?.summary?.total ?? 0) > 0 ||
  getFunctionalRegression(page).status === "Failed";

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
        "rounded-[28px] border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-6",
        strong
          ? "border-white/14 bg-[linear-gradient(180deg,rgba(10,34,42,0.92),rgba(5,20,28,0.95))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]",
        className
      )}
    >
      {children}
    </section>
  );
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">{eyebrow}</p>
      <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
      {subtitle ? <p className="text-sm leading-6 text-slate-300/80">{subtitle}</p> : null}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={cx("rounded-2xl border p-4", accent ? "border-emerald-300/18 bg-emerald-300/8" : "border-white/10 bg-white/5")}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/68">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="overflow-hidden rounded-full border border-white/10 bg-white/8">
      <div
        className="h-3 rounded-full bg-[linear-gradient(90deg,#7ef0d6_0%,#37d2b8_52%,#79b8ff_100%)] transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  );
}

function IssueCard({ page, selected, onSelect }: { page: MonitorPageResult; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "w-full rounded-[24px] border p-4 text-left transition",
        selected ? "border-emerald-300/26 bg-[linear-gradient(135deg,rgba(126,240,214,0.16),rgba(84,148,255,0.14))]" : "border-white/10 bg-white/5 hover:border-white/18 hover:bg-white/8"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{page.path}</p>
          <p className="mt-1 break-all text-xs text-slate-300/68">{page.url}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">View</span>
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
          eyebrow="Archive"
          title="Recent scans"
          subtitle="Download previous reports and review the latest stored runs."
        />
        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {scans.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300/78">
              No scan history yet.
            </div>
          ) : (
            scans.map((scan) => (
              <div key={scan.id} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Scan #{scan.id} • {scan.visual_status}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300/60">
                      mismatch {scan.visual_mismatch_percentage}% • pages {scan.dom_summary?.totalPages ?? 1}
                    </p>
                  </div>
                  <button
                    onClick={() => onExport(scan.id)}
                    disabled={exportingId === scan.id}
                    className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportingId === scan.id ? "Exporting..." : "Download PDF"}
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-300/74">{new Date(scan.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function DetailView({ page, history, sliderValue }: { page: MonitorPageResult; history: ScanRecord[]; sliderValue: number }) {
  const baselineImage = imageUrl(page.visualRegression.baselineImageUrl) ?? "";
  const currentImage = imageUrl(page.visualRegression.currentImageUrl) ?? "";
  const diffImage = imageUrl(page.visualRegression.diffImageUrl);
  const functional = getFunctionalRegression(page);
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
    .filter(Boolean) as Array<{ scanId: number; createdAt: string; mismatch: number; dom: number; functional: string }>;

  return (
    <Card strong>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">Regression Detail</p>
          <h4 className="text-2xl font-semibold tracking-tight text-white">{page.path}</h4>
          <p className="break-all text-sm text-slate-300/76">{page.url}</p>
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
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/66">Baseline</p>
                <img src={baselineImage} alt={`Baseline screenshot for ${page.path}`} className="w-full rounded-2xl border border-white/8" />
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/66">Current</p>
                <img src={currentImage} alt={`Current screenshot for ${page.path}`} className="w-full rounded-2xl border border-white/8" />
              </div>
            </div>
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/6 p-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px]">
                <img src={baselineImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${sliderValue}%` }}>
                  <img src={currentImage} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)]" style={{ left: `${sliderValue}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-black/15 p-3">
            {diffImage ? <img src={diffImage} alt={`Diff screenshot for ${page.path}`} className="w-full rounded-[20px] border border-white/8" /> : <div className="rounded-[20px] border border-dashed border-white/14 bg-white/4 p-10 text-sm text-slate-300/78">Diff image appears after a baseline already exists.</div>}
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <h5 className="text-lg font-semibold text-white">Change timeline</h5>
            <div className="mt-4 space-y-3">
              {timeline.length === 0 ? <p className="text-sm text-slate-300/78">No prior page-level history is available yet.</p> : timeline.map((entry) => <div key={entry.scanId} className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-sm font-semibold text-white">Scan #{entry.scanId}</p><p className="mt-1 text-sm text-slate-300/74">{new Date(entry.createdAt).toLocaleString()}</p><p className="mt-2 text-sm text-slate-300/82">Mismatch {entry.mismatch}% / DOM {entry.dom} / Functional {entry.functional}</p></div>)}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <h5 className="text-lg font-semibold text-white">Functional snapshot</h5>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Broken Links" value={functional.brokenLinks.length} />
              <Stat label="Console" value={functional.consoleErrors.length} />
              <Stat label="Forms" value={functional.form.count} />
              <Stat label="Flow" value={functional.flow.passed ? "Pass" : "Fail"} />
            </div>
            <div className="mt-4 space-y-2">
              {functional.consoleErrors.length > 0 ? functional.consoleErrors.map((error, index) => <pre key={`${page.pageId}-console-${index}`} className="overflow-auto rounded-2xl border border-red-300/14 bg-red-300/8 p-3 text-xs text-red-50">{error}</pre>) : <p className="text-sm text-slate-300/78">No console errors captured for this page.</p>}
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-white">Bad and broken links</p>
              {functional.brokenLinks.length > 0 ? (
                functional.brokenLinks.map((link, index) => (
                  <div key={`${page.pageId}-broken-link-${index}`} className="rounded-2xl border border-amber-300/14 bg-amber-300/8 p-3 text-sm text-amber-50">
                    <p className="break-all font-medium">{link.url}</p>
                    <p className="mt-1 text-xs text-amber-50/80">
                      Status: {link.statusCode ?? "No response"}{link.error ? ` / ${link.error}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-300/78">No bad or broken links were detected for this page.</p>
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
  const [result, setResult] = useState<MonitorResponse | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [job, setJob] = useState<ScanJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    const channel = supabase.channel(`scan-history-${websiteId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "scans", filter: `website_id=eq.${websiteId}` }, (payload: { new: unknown }) => {
      setHistory((prev) => [payload.new as ScanRecord, ...prev].slice(0, 20));
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.websiteId, result?.websiteId]);

  const issuePages = useMemo(() => result?.pageResults.filter(hasIssue) ?? [], [result]);
  const selectedPage = useMemo(() => issuePages.find((page) => page.pageId === selectedPageId) ?? issuePages[0] ?? null, [issuePages, selectedPageId]);

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
        enableSmokeTests
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
              eyebrow="Launch Scan"
              title="Run a polished regression pass"
              subtitle="Enter a production URL, optionally attach a repository, and decide whether this run should include smoke testing."
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Website URL</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-400/70 focus:border-emerald-300/35 focus:bg-white/10"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">GitHub Repo URL</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-400/70 focus:border-sky-300/35 focus:bg-white/10"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </label>

            <label className="flex items-start gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(126,240,214,0.1),rgba(255,255,255,0.04))] p-4">
              <input
                type="checkbox"
                checked={enableSmokeTests}
                onChange={(e) => setEnableSmokeTests(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-emerald-300 focus:ring-emerald-300"
              />
              <div>
                <p className="text-sm font-semibold text-white">Enable smoke testing</p>
                <p className="mt-1 text-sm leading-6 text-slate-300/78">
                  Add status checks, load-time measurement, console monitoring, broken-link detection,
                  form coverage, and a lightweight contact-flow test.
                </p>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleScan}
                disabled={loading || !url}
                className="rounded-full bg-[linear-gradient(90deg,#7ef0d6_0%,#37d2b8_52%,#79b8ff_100%)] px-6 py-3 text-sm font-semibold text-[#06242b] shadow-[0_18px_42px_rgba(126,240,214,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Scanning..." : "Start Scan"}
              </button>
              <p className="text-sm text-slate-300/74">
                Lean by default, deeper when smoke coverage is switched on.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Coverage" value="Visual + DOM" accent />
            <Stat label="Optional" value="Smoke Tests" />
            <Stat label="Workflow" value="Issue-first Review" />
            <Stat label="Execution" value="Parallel Workers" />
            <div className="sm:col-span-2 rounded-[24px] border border-white/10 bg-white/6 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/66">
                Operator Notes
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Sharper layout, stronger hierarchy, and cleaner monitoring surfaces.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">
                The experience is designed to feel more like a professional command center than a stack of
                raw result boxes.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {job ? (
        <Card className="reveal-up reveal-delay-1">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Header
                eyebrow="Live Progress"
                title="Scan in motion"
                subtitle="Realtime feedback from the queue-backed worker pipeline."
              />
              <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white">
                {job.progressPercentage}%
              </div>
            </div>
            <ProgressBar progress={job.progressPercentage} />
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Status" value={job.message} />
              <Stat label="Pages" value={`${job.completedPages} / ${job.totalPages || "?"}`} />
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/68">Current</p>
                <p className="mt-2 break-all text-sm text-slate-200/84">{job.currentPageUrl ?? "Preparing worker..."}</p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {error ? <div className="rounded-[24px] border border-red-300/16 bg-red-300/8 px-5 py-4 text-sm text-red-50 reveal-up">{error}</div> : null}

      {result ? (
        <div className="space-y-6 reveal-up reveal-delay-2">
          <style>{`
            .diff-add { background: rgba(34, 197, 94, 0.25); }
            .diff-del { background: rgba(239, 68, 68, 0.25); text-decoration: line-through; }
          `}</style>

          <Card strong>
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">Scan Result</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">{result.siteName}</h3>
                  <p className="mt-2 text-sm text-slate-300/78">{result.siteUrl}</p>
                  {result.message ? <p className="mt-3 text-sm text-slate-200/82">{result.message}</p> : null}
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting ? "Exporting..." : "Export PDF Report"}
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <Header eyebrow="Regression Summary" title="What changed in this run" />
                  <div className="grid gap-3 md:grid-cols-3">
                    <Stat label="Pages" value={result.summary.totalPages} accent />
                    <Stat label="New Pages" value={result.summary.newPages} />
                    <Stat label="Visual Changes" value={result.summary.pagesWithVisualChanges} />
                    <Stat label="DOM Changes" value={result.summary.pagesWithDomChanges} />
                    <Stat label="Max Mismatch" value={`${result.summary.highestVisualMismatch}%`} />
                    <Stat label="Overall" value={result.summary.overallStatus} />
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/66">Smoke Summary</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300/72">Enabled</span><span className="font-semibold text-white">{result.smokeTestingEnabled ? "Yes" : "No"}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300/72">Status</span><span className="font-semibold text-white">{result.functionalSummary.overallStatus}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300/72">Failed Pages</span><span className="font-semibold text-white">{result.functionalSummary.failedPages}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300/72">Broken Links</span><span className="font-semibold text-white">{result.functionalSummary.brokenLinks}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300/72">Avg Load</span><span className="font-semibold text-white">{formatDuration(result.functionalSummary.averageLoadTimeMs)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[350px,1fr]">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Header eyebrow="Issue Queue" title="Detected issues" subtitle="Select a page to review its evidence." />
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white">{issuePages.length}</span>
                </div>
                {issuePages.length === 0 ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300/78">
                    No visual, DOM, or functional issues were detected in this scan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issuePages.map((page) => (
                      <IssueCard key={page.pageId} page={page} selected={selectedPage?.pageId === page.pageId} onSelect={() => setSelectedPageId(page.pageId)} />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Header eyebrow="Compare" title="Interactive slider" subtitle="Drag across the boundary to compare baseline and current." />
                  <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white">{sliderValue}%</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  className="mt-5 w-full accent-emerald-300"
                />
              </Card>
              {selectedPage ? <DetailView page={selectedPage} history={history} sliderValue={sliderValue} /> : null}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <Card>
              <div className="space-y-4">
                <Header eyebrow="Worker System" title="Execution pipeline" subtitle="Current worker-pool telemetry from the queue-backed scan engine." />
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
