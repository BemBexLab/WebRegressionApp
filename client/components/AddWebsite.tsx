"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchScanHistory,
  exportScanReport,
  exportScanReportById,
  fetchScanJob,
  imageUrl,
  startWebsiteScan,
  type MonitorPageResult,
  type MonitorResponse,
  type ScanJobStatus,
  type ScanRecord
} from "@/lib/api";
import { supabase } from "@/lib/supabase";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="overflow-hidden rounded-full border border-slate-200 bg-slate-100">
      <div
        className="h-3 bg-slate-900 transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
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
    <div>
      <h4 className="mb-2 text-base font-semibold text-slate-900">Recent Scans (Realtime)</h4>
      <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-slate-200 bg-white p-3">
        {scans.length === 0 && <p className="text-sm text-slate-500">No scan history yet.</p>}
        {scans.map((scan) => (
          <div key={scan.id} className="rounded-md border border-slate-200 p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">
                #{scan.id} | {scan.visual_status} | {scan.visual_mismatch_percentage}%
              </p>
              <button
                onClick={() => onExport(scan.id)}
                disabled={exportingId === scan.id}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingId === scan.id ? "Exporting..." : "Download PDF"}
              </button>
            </div>
            <p className="text-slate-500">
              Pages: {scan.dom_summary?.totalPages ?? 1} | New: {scan.dom_summary?.newPages ?? 0} | DOM
              changes: {scan.dom_summary?.pagesWithDomChanges ?? 0}
            </p>
            <p className="text-slate-500">{new Date(scan.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageResultCard({ page }: { page: MonitorPageResult }) {
  return (
    <article className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h4 className="text-base font-semibold text-slate-900">{page.path}</h4>
        <p className="break-all text-sm text-slate-500">{page.url}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Mismatch %" value={page.visualRegression.mismatchPercentage} />
        <Stat label="Visual" value={page.visualRegression.status} />
        <Stat label="Baseline" value={page.baselineCreated ? "Created" : "Existing"} />
        <Stat label="DOM Total" value={page.domRegression.summary.total} />
        <Stat label="DOM Severity" value={page.domRegression.summary.severity} />
        <Stat label="Selectors" value={page.domRegression.changedSelectors.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Before (Baseline)</p>
          <img
            src={imageUrl(page.visualRegression.baselineImageUrl) ?? ""}
            alt={`Baseline screenshot for ${page.path}`}
            className="w-full rounded-md border border-slate-300"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">After (Current)</p>
          <img
            src={imageUrl(page.visualRegression.currentImageUrl) ?? ""}
            alt={`Current screenshot for ${page.path}`}
            className="w-full rounded-md border border-slate-300"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Diff</p>
          {page.visualRegression.diffImageUrl ? (
            <img
              src={imageUrl(page.visualRegression.diffImageUrl) ?? ""}
              alt={`Diff screenshot for ${page.path}`}
              className="w-full rounded-md border border-slate-300"
            />
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Diff image appears after the baseline already exists for this page.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function buildAggregateDomSnippets(pages: MonitorPageResult[]) {
  return pages.flatMap((page) =>
    (page.domRegression?.diffLog ?? []).reduce(
      (acc, change, index) => {
        const beforeHtml = change.beforeHtml ?? "";
        const afterHtml = change.afterHtml ?? "";
        const hasSnapshot = Boolean(beforeHtml || afterHtml);
        const isDifferent = beforeHtml !== afterHtml;

        if (!hasSnapshot || !isDifferent) {
          return acc;
        }

        acc.push({
          id: `${page.pageId}-${index}`,
          pagePath: page.path,
          type: change.type,
          selector: change.selector,
          beforeHtml,
          afterHtml
        });

        return acc;
      },
      [] as Array<{
        id: string;
        pagePath: string;
        type: string;
        selector: string;
        beforeHtml: string;
        afterHtml: string;
      }>
    )
  );
}

export default function AddWebsite() {
  const [url, setUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [result, setResult] = useState<MonitorResponse | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [job, setJob] = useState<ScanJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingScanId, setExportingScanId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const pollingRef = useRef<number | null>(null);
  const pollingFailureCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const websiteId = result?.websiteId ?? job?.websiteId;

    if (!websiteId) return;

    const channel = supabase
      .channel(`scan-history-${websiteId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scans",
          filter: `website_id=eq.${websiteId}`
        },
        (payload: { new: unknown }) => {
          setHistory((prev) => [payload.new as ScanRecord, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.websiteId, result?.websiteId]);

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
        const scans = await fetchScanHistory(nextJob.result.websiteId);
        setHistory(scans);
        return;
      }

      if (nextJob.status === "failed") {
        stopPolling();
        setLoading(false);
        setError(nextJob.error || "Scan failed.");
        return;
      }

      pollingRef.current = window.setTimeout(() => {
        void pollJob(jobId);
      }, 1000);
    } catch (pollError) {
      pollingFailureCountRef.current += 1;

      if (pollingFailureCountRef.current >= 10) {
        stopPolling();
        setLoading(false);
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to fetch scan progress."
        );
        return;
      }

      pollingRef.current = window.setTimeout(() => {
        void pollJob(jobId);
      }, 1500);
    }
  };

  const handleScan = async () => {
    stopPolling();
    setLoading(true);
    setError("");
    setResult(null);
    setHistory([]);
    setJob(null);
    pollingFailureCountRef.current = 0;

    try {
      const payload = githubUrl.trim() ? { url, githubUrl } : { url };
      const { jobId } = await startWebsiteScan(payload);
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
      const blob = await exportScanReport(result);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scan-report-${result.websiteId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
      const blob = await exportScanReportById(scanId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scan-report-${scanId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export report.");
    } finally {
      setExportingScanId(null);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Website URL</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">GitHub Repo URL (Optional)</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2"
          placeholder="https://github.com/owner/repo"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
        />
      </label>

      <button
        onClick={handleScan}
        disabled={loading || !url}
        className="rounded-md bg-slate-900 px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Scanning..." : "Scan URL"}
      </button>

      {job && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-900">Scan Progress</h3>
            <span className="text-sm font-medium text-slate-600">{job.progressPercentage}%</span>
          </div>
          <ProgressBar progress={job.progressPercentage} />
          <p className="text-sm text-slate-600">{job.message}</p>
          {job.totalPages > 0 && (
            <p className="text-sm text-slate-500">
              {job.completedPages} / {job.totalPages} pages completed
            </p>
          )}
          {job.currentPageUrl && <p className="break-all text-sm text-slate-500">{job.currentPageUrl}</p>}
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <section className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <style>{`
            .diff-add { background: rgba(34, 197, 94, 0.25); }
            .diff-del { background: rgba(239, 68, 68, 0.25); text-decoration: line-through; }
          `}</style>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Site Scan: {result.siteUrl}</h3>
            <p className="text-sm text-slate-500">{result.siteName}</p>
            {result.message && <p className="text-sm text-slate-600">{result.message}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export PDF Report"}
            </button>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-900">Crawl Summary</h4>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Pages" value={result.summary.totalPages} />
              <Stat label="New Pages" value={result.summary.newPages} />
              <Stat label="Visual Changes" value={result.summary.pagesWithVisualChanges} />
              <Stat label="DOM Changes" value={result.summary.pagesWithDomChanges} />
              <Stat label="Max Mismatch %" value={result.summary.highestVisualMismatch} />
              <Stat label="Overall" value={result.summary.overallStatus} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-base font-semibold text-slate-900">Page Results</h4>
            {result.pageResults.filter((page) => {
              const visualChanged = (page.visualRegression?.mismatchPercentage ?? 0) > 0;
              const domChanged = (page.domRegression?.summary?.total ?? 0) > 0;
              return visualChanged || domChanged;
            }).length === 0 ? (
              <p className="text-sm text-slate-600">No visual or DOM changes detected.</p>
            ) : (
              <div className="space-y-4">
                {result.pageResults
                  .filter((page) => {
                    const visualChanged = (page.visualRegression?.mismatchPercentage ?? 0) > 0;
                    const domChanged = (page.domRegression?.summary?.total ?? 0) > 0;
                    return visualChanged || domChanged;
                  })
                  .map((page) => (
                    <PageResultCard key={page.pageId} page={page} />
                  ))}
              </div>
            )}
          </div>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">DOM Changes (Aggregated)</h4>
            {buildAggregateDomSnippets(result.pageResults).length === 0 ? (
              <p className="text-sm text-slate-600">No DOM changes detected in this scan.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Showing before/after HTML snippets with highlights for each change.
                </p>
                <div className="space-y-4">
                  {buildAggregateDomSnippets(result.pageResults).map((entry) => (
                    <div key={entry.id} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase">
                          {entry.type.replace(/_/g, " ")}
                        </span>
                        <span className="font-medium text-slate-900">{entry.pagePath}</span>
                        <span className="text-slate-500">{entry.selector}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Before</p>
                          <pre
                            className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100"
                            dangerouslySetInnerHTML={{ __html: entry.beforeHtml || "<span class='text-slate-400'>No before HTML</span>" }}
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">After</p>
                          <pre
                            className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100"
                            dangerouslySetInnerHTML={{ __html: entry.afterHtml || "<span class='text-slate-400'>No after HTML</span>" }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {result.codeRegression && (
            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h4 className="text-base font-semibold text-slate-900">GitHub Codebase Changes</h4>
                <p className="break-all text-sm text-slate-500">{result.codeRegression.repositoryUrl}</p>
                <p className="text-sm text-slate-500">
                  Branch: {result.codeRegression.branch} | Commit:{" "}
                  {result.codeRegression.currentCommitSha.slice(0, 7)}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                <Stat label="Changed Files" value={result.codeRegression.summary.totalChangedFiles} />
                <Stat label="Added" value={result.codeRegression.summary.added} />
                <Stat label="Removed" value={result.codeRegression.summary.removed} />
                <Stat label="Modified" value={result.codeRegression.summary.modified} />
                <Stat label="Renamed" value={result.codeRegression.summary.renamed} />
              </div>

              {result.codeRegression.baselineCreated ? (
                <p className="text-sm text-slate-600">
                  Repository baseline created. Run another scan to compare future code changes.
                </p>
              ) : result.codeRegression.changedFiles.length === 0 ? (
                <p className="text-sm text-slate-600">No code changes detected since the previous scan.</p>
              ) : (
                <div className="space-y-3">
                  {result.codeRegression.changedFiles.map((file) => (
                    <div key={`${file.status}-${file.path}`} className="rounded-md border border-slate-200 p-3">
                      <p className="font-medium text-slate-900">
                        {file.status.toUpperCase()} | {file.path}
                      </p>
                      <p className="text-sm text-slate-500">
                        +{file.additions} / -{file.deletions} / {file.changes} changes
                      </p>
                      {file.previousPath && (
                        <p className="text-sm text-slate-500">Previous path: {file.previousPath}</p>
                      )}
                      {file.patch && (
                        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                          {file.patch}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <ScanHistory scans={history} onExport={handleExportScan} exportingId={exportingScanId} />
        </section>
      )}
    </div>
  );
}
