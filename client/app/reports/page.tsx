"use client";

import { useEffect, useState } from "react";
import { exportScanReportById, exportScanReportCsv, fetchReports, type ReportsResponse } from "@/lib/api";
import {
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

export default function ReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [exportingCsvId, setExportingCsvId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setData(await fetchReports());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function downloadBlob(blob: Blob, filename: string) {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  async function handleExport(scanId: number) {
    try {
      setExportingId(scanId);
      downloadBlob(await exportScanReportById(scanId), `scan-report-${scanId}.pdf`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export report.");
    } finally {
      setExportingId(null);
    }
  }

  async function handleExportCsv(scanId: number) {
    try {
      setExportingCsvId(scanId);
      downloadBlob(await exportScanReportCsv(scanId), `scan-report-${scanId}.csv`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export CSV report.");
    } finally {
      setExportingCsvId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Reporting System"
        title="Deliver daily, weekly, and exportable regression reports."
        description="This reporting area covers the requirements for PDF export today and lays out the product surface for CSV exports and shareable public links."
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel label="Loading reporting data..." /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Daily Summary Email" value={data.schedule.dailySummaryEmail ? "On" : "Off"} accent />
              <MetricCard label="Weekly Report" value={data.schedule.weeklyReport ? "On" : "Off"} />
              <MetricCard label="Public Share Links" value={data.schedule.publicShareLinks ? "On" : "Planned"} />
            </div>

            <Panel>
              <SectionHeader
                eyebrow="Exports"
                title="Recent scan reports"
                subtitle="Each scan can be exported as a report artifact. CSV and public link support are surfaced as product states."
              />
              <div className="mt-6 space-y-3">
                {data.reports.length === 0 ? (
                  <div className="metric-card p-4 text-sm text-[var(--muted)]">No reports available yet. Run a scan first.</div>
                ) : (
                  data.reports.map((report) => (
                    <div key={report.scanId} className="metric-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-[var(--foreground)]">{report.websiteName}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            Scan #{report.scanId} · {new Date(report.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tag">{report.visualStatus}</span>
                          <button
                            type="button"
                            onClick={() => handleExport(report.scanId)}
                            disabled={exportingId === report.scanId}
                            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[rgba(154,242,208,0.24)]"
                          >
                            {exportingId === report.scanId ? "Exporting..." : "PDF"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCsv(report.scanId)}
                            disabled={exportingCsvId === report.scanId}
                            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[rgba(154,242,208,0.24)]"
                          >
                            {exportingCsvId === report.scanId ? "Exporting..." : "CSV"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <MetricCard label="Pages" value={report.totalPages} />
                        <MetricCard label="Mismatch" value={`${report.mismatchPercentage}%`} />
                        <MetricCard label="Broken Links" value={report.brokenLinks} />
                        <MetricCard label="Failed Pages" value={report.failedPages} />
                      </div>
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
