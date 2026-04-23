const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

function normalizeApiBase(input: string) {
  if (!/^https?:\/\//i.test(input)) {
    return "";
  }

  const trimmed = input.replace(/\/+$/, "");
  if (/\/api\/health$/i.test(trimmed)) {
    return trimmed.replace(/\/api\/health$/i, "");
  }
  if (/\/health$/i.test(trimmed)) {
    return trimmed.replace(/\/health$/i, "");
  }

  return trimmed;
}

function resolveFallbackApiBase() {
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:5000";
  }

  return "";
}

const FALLBACK_API_BASE = resolveFallbackApiBase();
const API_BASE = normalizeApiBase(RAW_API_BASE);

async function apiFetch(path: string, init?: RequestInit) {
  const base = API_BASE || FALLBACK_API_BASE;
  if (!base) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL in production. Set it to your backend origin, e.g. https://your-backend.example.com"
    );
  }
  const primaryUrl = `${base}${path}`;

  try {
    return await fetch(primaryUrl, init);
  } catch (primaryError) {
    if (!FALLBACK_API_BASE || base === FALLBACK_API_BASE) {
      throw primaryError;
    }

    try {
      return await fetch(`${FALLBACK_API_BASE}${path}`, init);
    } catch {
      throw new Error(
        `Network error while calling ${path}. Ensure backend is running on http://localhost:5000 and restart client dev server.`
      );
    }
  }
}

export type MonitorPayload = { url: string; githubUrl?: string; enableSmokeTests?: boolean };

export type ScanJobStartResponse = {
  jobId: string;
};

export type ScanJobStatus = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  progressPercentage: number;
  message: string;
  websiteId: string | null;
  siteName: string | null;
  totalPages: number;
  completedPages: number;
  currentPageUrl: string | null;
  result: MonitorResponse | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScanRecord = {
  id: number;
  website_id: string;
  baseline_created: boolean;
  visual_mismatch_percentage: number;
  visual_status: "Pass" | "Warning" | "Critical";
  visual_baseline_image_url: string | null;
  visual_current_image_url: string | null;
  visual_diff_image_url: string | null;
  dom_summary: {
    total: number;
    added: number;
    removed: number;
    attributeChanged: number;
    textChanged: number;
    severity: "None" | "Low" | "Medium" | "High";
    totalPages?: number;
    newPages?: number;
    pagesWithVisualChanges?: number;
    pagesWithDomChanges?: number;
  };
  report_payload?: MonitorResponse;
  created_at: string;
};

export type FunctionalRegression = {
  pageUrl: string;
  responseCode: number | null;
  loadTimeMs: number | null;
  testedAt: string;
  status: "Healthy" | "Warning" | "Failed";
  coreElements: Array<{
    name: string;
    selector: string;
    exists: boolean;
  }>;
  missingCoreElements: string[];
  consoleErrors: string[];
  brokenLinks: Array<{
    url: string;
    statusCode: number | null;
    error?: string;
  }>;
  form: {
    available: boolean;
    count: number;
    interactiveControlCount: number;
    requiredFieldCount?: number;
    semanticValidationCount?: number;
    formWithSubmitCount?: number;
  };
  flow: {
    attempted: boolean;
    passed: boolean;
    step: string | null;
    targetUrl: string | null;
    details: string;
  };
  requestFailures: Array<{
    url: string;
    error: string;
  }>;
  checks?: Array<{
    id: string;
    label: string;
    status: "Passed" | "Warning" | "Failed" | "Skipped";
    applicable: boolean;
    summary: string;
    findings: string[];
  }>;
  checkSummary?: {
    passed: number;
    warning: number;
    failed: number;
    skipped: number;
  };
  metrics?: {
    internalLinksChecked: number;
    navLinksChecked: number;
    buttonTargetsChecked: number;
    formsDetected: number;
    authArtifactsDetected: number;
    searchArtifactsDetected: number;
    apiFailures: number;
    cookiesObserved: number;
    fileInputsDetected: number;
    downloadLinksDetected: number;
  };
};

export type MonitorPageResult = {
  pageId: string;
  url: string;
  path: string;
  baselineCreated: boolean;
  visualRegression: {
    mismatchPixels?: number;
    totalPixels?: number;
    mismatchPercentage: number;
    status: "Pass" | "Warning" | "Critical";
    baselineImageUrl: string;
    currentImageUrl: string;
    diffImageUrl: string | null;
  };
  domRegression: {
    summary: {
      total: number;
      added: number;
      removed: number;
      attributeChanged: number;
      textChanged: number;
      severity: "None" | "Low" | "Medium" | "High";
    };
    changedSelectors: string[];
    diffLog: Array<{
      type: string;
      selector: string;
      oldHtml?: string;
      newHtml?: string;
      beforeHtml?: string;
      afterHtml?: string;
      oldText?: string;
      newText?: string;
      oldAttributes?: Record<string, string>;
      newAttributes?: Record<string, string>;
    }>;
    unifiedDiff?: string;
  };
  functionalRegression: FunctionalRegression;
};

export type MonitorResponse = {
  baselineCreated: boolean;
  message?: string;
  websiteId: string;
  scanId: number | null;
  siteUrl: string;
  siteName: string;
  githubUrl: string | null;
  smokeTestingEnabled: boolean;
  summary: {
    totalPages: number;
    newPages: number;
    pagesWithVisualChanges: number;
    pagesWithDomChanges: number;
    highestVisualMismatch: number;
    overallStatus: "Pass" | "Warning" | "Critical";
  };
  functionalSummary: {
    enabled: boolean;
    totalPages: number;
    checkedPages: number;
    failedPages: number;
    warningPages: number;
    consoleErrors: number;
    brokenLinks: number;
    requestFailures: number;
    averageLoadTimeMs: number | null;
    overallStatus: "Disabled" | "Healthy" | "Warning" | "Failed";
  };
  workerSystem: {
    queueDepth: number;
    activeWorkers: number;
    maxWorkers: number;
    autoScaling: boolean;
    distributedReady: boolean;
    retryLimit: number;
    timeoutMs: number;
  };
  visualRegression: {
    mismatchPixels?: number;
    totalPixels?: number;
    mismatchPercentage: number;
    status: "Pass" | "Warning" | "Critical";
    baselineImageUrl: string;
    currentImageUrl: string;
    diffImageUrl: string | null;
  };
  domRegression: {
    summary: {
      total: number;
      added: number;
      removed: number;
      attributeChanged: number;
      textChanged: number;
      severity: "None" | "Low" | "Medium" | "High";
    };
    changedSelectors: string[];
    diffLog: Array<Record<string, unknown>>;
  };
  functionalRegression: FunctionalRegression;
  pageResults: MonitorPageResult[];
  codeRegression: {
    baselineCreated: boolean;
    repositoryUrl: string;
    branch: string;
    previousCommitSha: string | null;
    currentCommitSha: string;
    currentCommitUrl: string | null;
    summary: {
      totalChangedFiles: number;
      added: number;
      removed: number;
      modified: number;
      renamed: number;
    };
    changedFiles: Array<{
      path: string;
      previousPath: string | null;
      status: string;
      additions: number;
      deletions: number;
      changes: number;
      patch: string | null;
      blobUrl: string | null;
    }>;
  } | null;
};

export function imageUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE || FALLBACK_API_BASE}${path}`;
}

export async function startWebsiteScan(payload: MonitorPayload): Promise<ScanJobStartResponse> {
  const res = await apiFetch("/api/monitor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to start website scan.");
  }

  return res.json();
}

export async function fetchScanJob(jobId: string): Promise<ScanJobStatus> {
  const res = await apiFetch(`/api/monitor/jobs/${jobId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch scan progress.");
  }

  return res.json();
}

export async function fetchScanHistory(websiteId: string): Promise<ScanRecord[]> {
  const res = await apiFetch(`/api/monitor/history/${websiteId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch scan history.");
  }

  const body = await res.json();
  return (body.scans ?? []) as ScanRecord[];
}

export async function exportScanReport(result: MonitorResponse): Promise<Blob> {
  const res = await apiFetch("/api/monitor/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ result })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to export PDF report.");
  }

  return res.blob();
}

export async function exportScanReportById(scanId: number): Promise<Blob> {
  const res = await apiFetch(`/api/monitor/report/${scanId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to export PDF report.");
  }

  return res.blob();
}
