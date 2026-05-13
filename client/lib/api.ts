const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
const RAW_INTERNAL_API_BASE = process.env.INTERNAL_API_BASE_URL?.trim() || "";
const RAW_SUPABASE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";

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
const INTERNAL_API_BASE = normalizeApiBase(RAW_INTERNAL_API_BASE);
const SUPABASE_BASE = normalizeApiBase(RAW_SUPABASE_BASE);

function resolveRequestUrl(path: string) {
  if (typeof window !== "undefined") {
    return path;
  }

  const serverBase = API_BASE || INTERNAL_API_BASE || FALLBACK_API_BASE;
  if (!serverBase) {
    throw new Error(
      "Missing API base URL. Set NEXT_PUBLIC_API_BASE_URL or INTERNAL_API_BASE_URL to your backend origin."
    );
  }

  return `${serverBase}${path}`;
}

async function apiFetch(path: string, init?: RequestInit) {
  const primaryUrl = resolveRequestUrl(path);

  try {
    return await fetch(primaryUrl, init);
  } catch (primaryError) {
    if (typeof window !== "undefined") {
      throw primaryError;
    }

    const fallbackBase = INTERNAL_API_BASE || FALLBACK_API_BASE;
    if (!fallbackBase || primaryUrl === `${fallbackBase}${path}`) {
      throw primaryError;
    }

    try {
      return await fetch(`${fallbackBase}${path}`, init);
    } catch {
      throw new Error(
        `Network error while calling ${path}. Ensure the backend is reachable from the Next.js app.`
      );
    }
  }
}

export type MonitorPayload = {
  url: string;
  githubUrl?: string;
  enableSmokeTests?: boolean;
  viewport?: "desktop" | "mobile";
  thresholdPercentage?: number;
  ignoredSelectors?: string[];
  monitoringFrequency?: string;
  criticalElements?: string[];
};

export type WebsitePayload = {
  url: string;
  displayName: string;
  githubUrl?: string;
  viewport: "desktop" | "mobile";
  monitoringFrequency: string;
  thresholdPercentage: number;
  loadTimeThresholdMs: number;
  ignoredSelectors: string[];
  criticalElements: string[];
  monitoredPages: string[];
  alertChannels: string[];
  active: boolean;
};

export type WebsiteRecord = {
  id: string;
  workspace_id: string | null;
  site_key: string;
  url: string;
  display_name: string | null;
  github_url: string | null;
  viewport: "desktop" | "mobile";
  monitoring_frequency: string;
  threshold_percentage: number;
  load_time_threshold_ms: number;
  ignored_selectors: string[];
  critical_elements: string[];
  monitored_pages: string[];
  alert_channels: string[];
  active: boolean;
  last_scan_at: string | null;
  updated_at: string;
  created_at?: string;
};

export type WebsiteDetailResponse = {
  website: WebsiteRecord;
  scans: ScanRecord[];
};

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
  websiteConfig: {
    viewport: "desktop" | "mobile";
    thresholdPercentage: number;
    ignoredSelectors: string[];
  };
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

export type DashboardResponse = {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  plan: {
    key: string;
    name: string;
    max_websites: number;
    max_pages: number;
    scan_frequency: string;
    team_members: number;
    priority_processing: boolean;
    monthly_price_cents?: number;
    yearly_price_cents?: number;
  } | null;
  overview: {
    totalWebsites: number;
    totalPagesMonitored: number;
    activeRegressions: number;
    performanceWarnings: number;
    lastScanAt: string | null;
    teamMembers: number;
  };
  trend: Array<{
    date: string;
    mismatch: number;
    regressions: number;
    warnings: number;
  }>;
  websites: Array<{
    id: string;
    displayName: string;
    url: string;
    active: boolean;
    monitoringFrequency: string;
    viewport: "desktop" | "mobile";
    status: string;
    lastScanAt: string | null;
    highestMismatch: number;
    pages: string[];
    loadTimeMs: number | null;
  }>;
  workerSystem: {
    queueDepth: number;
    activeWorkers: number;
    maxWorkers: number;
    autoScaling: boolean;
    distributedReady: boolean;
    retryLimit: number;
    timeoutMs: number;
  };
};

export type ReportsResponse = {
  schedule: {
    dailySummaryEmail: boolean;
    weeklyReport: boolean;
    publicShareLinks: boolean;
  };
  reports: Array<{
    scanId: number;
    websiteId: string;
    websiteName: string;
    visualStatus: "Pass" | "Warning" | "Critical" | string;
    mismatchPercentage: number;
    createdAt: string;
    totalPages: number;
    brokenLinks: number;
    failedPages: number;
    exportFormats: string[];
    publicShareEnabled: boolean;
  }>;
};

export type AlertsResponse = {
  channels: Array<{
    id: string;
    workspace_id?: string;
    type: string;
    name: string;
    target: string;
    triggers: string[];
    enabled?: boolean;
  }>;
  triggers: string[];
  incidents: Array<{
    id: string;
    type: string;
    severity: string;
    websiteName: string;
    pageUrl: string | null;
    timestamp: string;
  }>;
};

export type BillingResponse = {
  currentPlan: DashboardResponse["plan"];
  usage: {
    websites: number;
    pages: number;
    teamMembers: number;
  };
  entitlements: {
    maxWebsites: number;
    maxPages: number;
    teamMembers: number;
    priorityProcessing: boolean;
  };
  plans: Array<{
    key: string;
    name: string;
    max_websites: number;
    max_pages: number;
    scan_frequency: string;
    team_members: number;
    priority_processing: boolean;
    monthly_price_cents: number;
    yearly_price_cents: number;
    monthlyPrice: number;
    yearlyPrice: number;
  }>;
  subscriptionFeatures: string[];
};

export type AdminResponse = {
  globalStats: {
    totalUsers: number;
    totalWorkspaces: number;
    totalWebsites: number;
    totalScans: number;
  };
  workerSystem: DashboardResponse["workerSystem"];
  featureFlags: Array<{
    key: string;
    label: string;
    enabled: boolean;
    scope: string;
  }>;
  recentJobs: Array<{
    job_id: string;
    site_name: string | null;
    status: "queued" | "running" | "completed" | "failed" | string;
    completed_pages: number;
    total_pages: number;
    progress_percentage: number;
    updated_at: string;
    message: string;
    error: string | null;
  }>;
};

export function imageUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/storage/")) {
    if (!SUPABASE_BASE) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL. Set it to your local Docker Supabase API origin, e.g. http://127.0.0.1:54321."
      );
    }
    return `${SUPABASE_BASE}${path}`;
  }
  if (typeof window !== "undefined") {
    return path;
  }

  const serverBase = API_BASE || INTERNAL_API_BASE || FALLBACK_API_BASE;
  if (!serverBase) {
    throw new Error(
      "Missing API base URL. Set NEXT_PUBLIC_API_BASE_URL or INTERNAL_API_BASE_URL to your backend origin."
    );
  }

  return `${serverBase}${path}`;
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

export async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await apiFetch("/api/platform/dashboard");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load dashboard.");
  }

  return res.json();
}

export async function fetchReports(): Promise<ReportsResponse> {
  const res = await apiFetch("/api/platform/reports");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load reports.");
  }

  return res.json();
}

export async function fetchAlerts(): Promise<AlertsResponse> {
  const res = await apiFetch("/api/platform/alerts");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load alerts.");
  }

  return res.json();
}

export async function fetchBilling(): Promise<BillingResponse> {
  const res = await apiFetch("/api/platform/billing");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load billing.");
  }

  return res.json();
}

export async function fetchAdmin(): Promise<AdminResponse> {
  const res = await apiFetch("/api/platform/admin");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load admin overview.");
  }

  return res.json();
}

export async function fetchWebsites(): Promise<WebsiteRecord[]> {
  const res = await apiFetch("/api/websites");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load websites.");
  }

  const body = await res.json();
  return (body.websites ?? []) as WebsiteRecord[];
}

export async function fetchWebsiteDetail(websiteId: string): Promise<WebsiteDetailResponse> {
  const res = await apiFetch(`/api/websites/${websiteId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load website detail.");
  }

  return res.json();
}

export async function createWebsite(payload: WebsitePayload): Promise<WebsiteRecord> {
  const res = await apiFetch("/api/websites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create website.");
  }

  return res.json();
}

export async function updateWebsite(websiteId: string, payload: WebsitePayload): Promise<WebsiteRecord> {
  const res = await apiFetch(`/api/websites/${websiteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update website.");
  }

  return res.json();
}

export async function deleteWebsite(websiteId: string): Promise<void> {
  const res = await apiFetch(`/api/websites/${websiteId}`, { method: "DELETE" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to delete website.");
  }
}

export async function exportScanReportCsv(scanId: number): Promise<Blob> {
  const res = await apiFetch(`/api/monitor/report/${scanId}/csv`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to export CSV report.");
  }

  return res.blob();
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
