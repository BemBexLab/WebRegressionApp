import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import {
  getFallbackSubscriptionPlans,
  getFallbackWorkspaceContext,
  getWorkspaceContext,
  isSupabaseUnavailableError
} from "../services/platformDataService.js";
import { getWorkerSystemSnapshot } from "../services/workerQueueService.js";

const router = Router();

function formatCurrency(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function fallbackDashboardResponse() {
  const context = getFallbackWorkspaceContext();

  return {
    workspace: {
      id: context.workspace.id,
      name: context.workspace.name,
      slug: context.workspace.slug
    },
    plan: context.plan,
    overview: {
      totalWebsites: 0,
      totalPagesMonitored: 0,
      activeRegressions: 0,
      performanceWarnings: 0,
      lastScanAt: null,
      teamMembers: context.members.length
    },
    trend: [],
    websites: [],
    workerSystem: getWorkerSystemSnapshot()
  };
}

function fallbackReportsResponse() {
  return {
    schedule: {
      dailySummaryEmail: true,
      weeklyReport: true,
      publicShareLinks: false
    },
    reports: []
  };
}

function fallbackAlertsResponse() {
  const context = getFallbackWorkspaceContext();

  return {
    channels: context.alertChannels,
    triggers: [
      "Visual difference exceeds threshold",
      "Page down",
      "4xx/5xx error",
      "Console errors",
      "Load time exceeds threshold"
    ],
    incidents: []
  };
}

function fallbackBillingResponse() {
  const context = getFallbackWorkspaceContext();
  const plans = getFallbackSubscriptionPlans().map((plan) => ({
    ...plan,
    monthlyPrice: formatCurrency(plan.monthly_price_cents),
    yearlyPrice: formatCurrency(plan.yearly_price_cents)
  }));

  return {
    currentPlan: context.plan,
    usage: {
      websites: 0,
      pages: 0,
      teamMembers: context.members.length
    },
    entitlements: {
      maxWebsites: context.plan?.max_websites ?? 0,
      maxPages: context.plan?.max_pages ?? 0,
      teamMembers: context.plan?.team_members ?? 0,
      priorityProcessing: Boolean(context.plan?.priority_processing)
    },
    plans,
    subscriptionFeatures: [
      "Recurring billing",
      "Upgrade / downgrade",
      "Usage-based billing (optional)",
      "Free trial",
      "Coupon system"
    ]
  };
}

function fallbackAdminResponse() {
  const context = getFallbackWorkspaceContext();

  return {
    globalStats: {
      totalUsers: context.members.length,
      totalWorkspaces: 1,
      totalWebsites: 0,
      totalScans: 0
    },
    workerSystem: getWorkerSystemSnapshot(),
    featureFlags: context.featureFlags,
    recentJobs: []
  };
}

router.get("/dashboard", async (req, res) => {
  try {
    const context = await getWorkspaceContext();
    const workspaceId = context.workspace.id;

    const [
      { data: websites, error: websitesError },
      { data: recentScans, error: scansError }
    ] = await Promise.all([
      supabase
        .from("websites")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("scans")
        .select("id, website_id, visual_mismatch_percentage, visual_status, created_at, report_payload")
        .order("created_at", { ascending: false })
        .limit(40)
    ]);

    if (websitesError) throw new Error(websitesError.message);
    if (scansError) throw new Error(scansError.message);

    const workspaceWebsiteIds = new Set((websites ?? []).map((website) => website.id));
    const scans = (recentScans ?? []).filter((scan) => workspaceWebsiteIds.has(scan.website_id));

    const websitesList = websites ?? [];
    const totalPagesMonitored = websitesList.reduce(
      (sum, website) => sum + (Array.isArray(website.monitored_pages) && website.monitored_pages.length > 0 ? website.monitored_pages.length : 1),
      0
    );
    const activeRegressions = scans.filter((scan) => scan.visual_status === "Critical").length;
    const performanceWarnings = scans.filter((scan) => {
      const avgLoad = scan.report_payload?.functionalSummary?.averageLoadTimeMs ?? 0;
      return avgLoad > 4000;
    }).length;

    const statusByWebsite = new Map();
    for (const scan of scans) {
      if (!statusByWebsite.has(scan.website_id)) {
        statusByWebsite.set(scan.website_id, scan);
      }
    }

    const siteCards = websitesList.map((website) => {
      const latest = statusByWebsite.get(website.id);
      const loadTime = latest?.report_payload?.functionalSummary?.averageLoadTimeMs ?? null;

      return {
        id: website.id,
        displayName: website.display_name || website.site_key,
        url: website.url,
        active: website.active,
        monitoringFrequency: website.monitoring_frequency,
        viewport: website.viewport,
        status: latest?.visual_status ?? "Unknown",
        lastScanAt: latest?.created_at ?? website.last_scan_at ?? null,
        highestMismatch: latest?.visual_mismatch_percentage ?? 0,
        pages: Array.isArray(website.monitored_pages) && website.monitored_pages.length > 0 ? website.monitored_pages : ["/"],
        loadTimeMs: loadTime
      };
    });

    const trend = scans.slice(0, 8).reverse().map((scan) => ({
      date: scan.created_at,
      mismatch: Number(scan.visual_mismatch_percentage || 0),
      regressions:
        (scan.report_payload?.summary?.pagesWithVisualChanges ?? 0) +
        (scan.report_payload?.summary?.pagesWithDomChanges ?? 0),
      warnings:
        (scan.report_payload?.functionalSummary?.warningPages ?? 0) +
        (scan.report_payload?.functionalSummary?.failedPages ?? 0)
    }));

    return res.json({
      workspace: {
        id: context.workspace.id,
        name: context.workspace.name,
        slug: context.workspace.slug
      },
      plan: context.plan,
      overview: {
        totalWebsites: websitesList.length,
        totalPagesMonitored,
        activeRegressions,
        performanceWarnings,
        lastScanAt: scans[0]?.created_at ?? null,
        teamMembers: context.members.length
      },
      trend,
      websites: siteCards,
      workerSystem: getWorkerSystemSnapshot()
    });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json(fallbackDashboardResponse());
    }
    return res.status(500).json({ error: error.message || "Failed to load dashboard." });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const context = await getWorkspaceContext();
    const { data: websites, error: websitesError } = await supabase
      .from("websites")
      .select("id, display_name, url, workspace_id")
      .eq("workspace_id", context.workspace.id);
    if (websitesError) throw new Error(websitesError.message);

    const websiteNameMap = new Map((websites ?? []).map((website) => [website.id, website.display_name || website.url]));
    const websiteIds = [...websiteNameMap.keys()];

    const { data: scans, error: scansError } = await supabase
      .from("scans")
      .select("id, website_id, visual_status, visual_mismatch_percentage, created_at, report_payload")
      .in("website_id", websiteIds.length > 0 ? websiteIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (scansError) throw new Error(scansError.message);

    const reports = (scans ?? []).map((scan) => ({
      scanId: scan.id,
      websiteId: scan.website_id,
      websiteName: websiteNameMap.get(scan.website_id) ?? "Website",
      visualStatus: scan.visual_status,
      mismatchPercentage: scan.visual_mismatch_percentage,
      createdAt: scan.created_at,
      totalPages: scan.report_payload?.summary?.totalPages ?? 0,
      brokenLinks: scan.report_payload?.functionalSummary?.brokenLinks ?? 0,
      failedPages: scan.report_payload?.functionalSummary?.failedPages ?? 0,
      exportFormats: ["pdf", "csv"],
      publicShareEnabled: false
    }));

    return res.json({
      schedule: {
        dailySummaryEmail: true,
        weeklyReport: true,
        publicShareLinks: false
      },
      reports
    });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json(fallbackReportsResponse());
    }
    return res.status(500).json({ error: error.message || "Failed to load reports." });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const context = await getWorkspaceContext();
    const { data: websites, error: websitesError } = await supabase
      .from("websites")
      .select("id, display_name, url, workspace_id")
      .eq("workspace_id", context.workspace.id);
    if (websitesError) throw new Error(websitesError.message);

    const websiteNameMap = new Map((websites ?? []).map((website) => [website.id, website.display_name || website.url]));
    const websiteIds = [...websiteNameMap.keys()];

    const { data: scans, error: scansError } = await supabase
      .from("scans")
      .select("id, website_id, visual_status, visual_mismatch_percentage, created_at, report_payload")
      .in("website_id", websiteIds.length > 0 ? websiteIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (scansError) throw new Error(scansError.message);

    const incidents = (scans ?? []).flatMap((scan) => {
      const report = scan.report_payload ?? {};
      const items = [];
      if (scan.visual_mismatch_percentage > 0.3) {
        items.push({
          id: `visual-${scan.id}`,
          type: "visual",
          severity: scan.visual_status,
          websiteName: websiteNameMap.get(scan.website_id) ?? "Website",
          pageUrl: report.siteUrl ?? null,
          timestamp: scan.created_at
        });
      }
      if ((report.functionalSummary?.failedPages ?? 0) > 0) {
        items.push({
          id: `functional-${scan.id}`,
          type: "functional",
          severity: "Failed",
          websiteName: websiteNameMap.get(scan.website_id) ?? "Website",
          pageUrl: report.siteUrl ?? null,
          timestamp: scan.created_at
        });
      }
      if ((report.functionalSummary?.brokenLinks ?? 0) > 0) {
        items.push({
          id: `links-${scan.id}`,
          type: "broken-links",
          severity: "Warning",
          websiteName: websiteNameMap.get(scan.website_id) ?? "Website",
          pageUrl: report.siteUrl ?? null,
          timestamp: scan.created_at
        });
      }
      return items;
    }).slice(0, 12);

    return res.json({
      channels: context.alertChannels,
      triggers: [
        "Visual difference exceeds threshold",
        "Page down",
        "4xx/5xx error",
        "Console errors",
        "Load time exceeds threshold"
      ],
      incidents
    });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json(fallbackAlertsResponse());
    }
    return res.status(500).json({ error: error.message || "Failed to load alerts." });
  }
});

router.get("/billing", async (req, res) => {
  try {
    const context = await getWorkspaceContext();
    const { data: plans, error: plansError } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("monthly_price_cents", { ascending: true });
    if (plansError) throw new Error(plansError.message);

    const { count: websitesCount, error: websitesError } = await supabase
      .from("websites")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id);
    if (websitesError) throw new Error(websitesError.message);

    const { data: websites, error: websiteListError } = await supabase
      .from("websites")
      .select("monitored_pages")
      .eq("workspace_id", context.workspace.id);
    if (websiteListError) throw new Error(websiteListError.message);

    const monitoredPages = (websites ?? []).reduce(
      (sum, website) => sum + (Array.isArray(website.monitored_pages) && website.monitored_pages.length > 0 ? website.monitored_pages.length : 1),
      0
    );

    return res.json({
      currentPlan: context.plan,
      usage: {
        websites: websitesCount ?? 0,
        pages: monitoredPages,
        teamMembers: context.members.length
      },
      entitlements: {
        maxWebsites: context.plan?.max_websites ?? 0,
        maxPages: context.plan?.max_pages ?? 0,
        teamMembers: context.plan?.team_members ?? 0,
        priorityProcessing: Boolean(context.plan?.priority_processing)
      },
      plans: (plans ?? []).map((plan) => ({
        ...plan,
        monthlyPrice: formatCurrency(plan.monthly_price_cents),
        yearlyPrice: formatCurrency(plan.yearly_price_cents)
      })),
      subscriptionFeatures: [
        "Recurring billing",
        "Upgrade / downgrade",
        "Usage-based billing (optional)",
        "Free trial",
        "Coupon system"
      ]
    });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json(fallbackBillingResponse());
    }
    return res.status(500).json({ error: error.message || "Failed to load billing." });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const context = await getWorkspaceContext();
    const [
      { count: websitesCount, error: websitesError },
      { count: scansCount, error: scansError },
      { data: latestJobs, error: jobsError }
    ] = await Promise.all([
      supabase.from("websites").select("*", { count: "exact", head: true }),
      supabase.from("scans").select("*", { count: "exact", head: true }),
      supabase.from("scan_jobs").select("*").order("updated_at", { ascending: false }).limit(10)
    ]);

    if (websitesError) throw new Error(websitesError.message);
    if (scansError) throw new Error(scansError.message);
    if (jobsError) throw new Error(jobsError.message);

    return res.json({
      globalStats: {
        totalUsers: context.members.length,
        totalWorkspaces: 1,
        totalWebsites: websitesCount ?? 0,
        totalScans: scansCount ?? 0
      },
      workerSystem: getWorkerSystemSnapshot(),
      featureFlags: context.featureFlags,
      recentJobs: latestJobs ?? []
    });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json(fallbackAdminResponse());
    }
    return res.status(500).json({ error: error.message || "Failed to load admin overview." });
  }
});

export default router;
