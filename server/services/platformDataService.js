import { supabase } from "../lib/supabase.js";

const DEFAULT_WORKSPACE_SLUG = "default-workspace";

const PLAN_SEEDS = [
  {
    key: "starter",
    name: "Starter",
    max_websites: 5,
    max_pages: 25,
    scan_frequency: "daily",
    team_members: 1,
    priority_processing: false,
    monthly_price_cents: 2900,
    yearly_price_cents: 29000
  },
  {
    key: "pro",
    name: "Pro",
    max_websites: 25,
    max_pages: 250,
    scan_frequency: "hourly",
    team_members: 5,
    priority_processing: false,
    monthly_price_cents: 9900,
    yearly_price_cents: 99000
  },
  {
    key: "agency",
    name: "Agency",
    max_websites: 100,
    max_pages: 1000,
    scan_frequency: "hourly",
    team_members: 20,
    priority_processing: true,
    monthly_price_cents: 24900,
    yearly_price_cents: 249000
  }
];

const ALERT_SEEDS = [
  {
    type: "email",
    name: "Ops Email",
    target: "alerts@example.com",
    triggers: ["visual", "uptime", "console", "load-time"]
  },
  {
    type: "slack",
    name: "Engineering Slack",
    target: "#regression-alerts",
    triggers: ["visual", "dom", "functional"]
  },
  {
    type: "webhook",
    name: "Automation Webhook",
    target: "https://example.com/webhooks/regression",
    triggers: ["visual", "functional", "performance"]
  }
];

const FEATURE_FLAG_SEEDS = [
  { key: "public_share_links", label: "Public Share Links", enabled: false, scope: "workspace" },
  { key: "whatsapp_alerts", label: "WhatsApp Alerts", enabled: false, scope: "workspace" },
  { key: "sms_alerts", label: "SMS Alerts", enabled: false, scope: "workspace" },
  { key: "white_label", label: "White Label Mode", enabled: false, scope: "workspace" }
];

function buildFallbackWorkspace() {
  return {
    id: "fallback-workspace",
    name: "Default Workspace",
    slug: DEFAULT_WORKSPACE_SLUG,
    owner_name: "Platform Owner",
    owner_email: "owner@example.com",
    plan_key: "pro"
  };
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

export function slugify(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isSupabaseUnavailableError(error) {
  const message = String(error?.message || error || "");
  return /fetch failed|ecconnrefused|enotfound|unable to connect|networkerror/i.test(message);
}

export function getFallbackWorkspaceContext() {
  const workspace = buildFallbackWorkspace();
  const plan = PLAN_SEEDS.find((entry) => entry.key === workspace.plan_key) ?? PLAN_SEEDS[1] ?? PLAN_SEEDS[0] ?? null;

  return {
    workspace,
    plan: plan ? cloneRecord(plan) : null,
    members: [
      {
        id: "fallback-owner",
        workspace_id: workspace.id,
        full_name: "Platform Owner",
        email: "owner@example.com",
        role: "Owner"
      }
    ],
    alertChannels: ALERT_SEEDS.map((channel, index) => ({
      id: `fallback-channel-${index + 1}`,
      workspace_id: workspace.id,
      ...cloneRecord(channel),
      enabled: true
    })),
    featureFlags: FEATURE_FLAG_SEEDS.map((flag) => cloneRecord(flag))
  };
}

export function getFallbackSubscriptionPlans() {
  return PLAN_SEEDS.map((plan) => cloneRecord(plan));
}

export function normalizeWebsitePayload(payload = {}) {
  const displayName = String(payload.displayName || "").trim();
  const url = String(payload.url || "").trim();
  const githubUrl = String(payload.githubUrl || "").trim();
  const viewport = payload.viewport === "mobile" ? "mobile" : "desktop";
  const monitoringFrequency = String(payload.monitoringFrequency || "daily").trim().toLowerCase();
  const thresholdPercentage = Math.max(0, Math.min(100, Number(payload.thresholdPercentage) || 0.3));
  const loadTimeThresholdMs = Math.max(500, Number(payload.loadTimeThresholdMs) || 4000);
  const ignoredSelectors = Array.isArray(payload.ignoredSelectors)
    ? payload.ignoredSelectors.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const criticalElements = Array.isArray(payload.criticalElements)
    ? payload.criticalElements.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const monitoredPages = Array.isArray(payload.monitoredPages)
    ? payload.monitoredPages.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const alertChannels = Array.isArray(payload.alertChannels)
    ? payload.alertChannels.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const active = payload.active === undefined ? true : Boolean(payload.active);

  return {
    url,
    display_name: displayName || new URL(url).hostname,
    site_key: slugify(displayName || new URL(url).hostname),
    github_url: githubUrl || null,
    viewport,
    monitoring_frequency: monitoringFrequency || "daily",
    threshold_percentage: thresholdPercentage,
    load_time_threshold_ms: loadTimeThresholdMs,
    ignored_selectors: ignoredSelectors,
    critical_elements: criticalElements,
    monitored_pages: monitoredPages,
    alert_channels: alertChannels,
    active,
    updated_at: new Date().toISOString()
  };
}

export async function ensurePlatformSeedData() {
  const { error: planError } = await supabase.from("subscription_plans").upsert(PLAN_SEEDS, {
    onConflict: "key"
  });
  if (planError) {
    throw new Error(planError.message);
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .upsert(
      {
        name: "Default Workspace",
        slug: DEFAULT_WORKSPACE_SLUG,
        owner_name: "Platform Owner",
        owner_email: "owner@example.com",
        plan_key: "pro",
        updated_at: new Date().toISOString()
      },
      { onConflict: "slug" }
    )
    .select("*")
    .single();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .upsert(
      {
        workspace_id: workspace.id,
        full_name: "Platform Owner",
        email: "owner@example.com",
        role: "Owner"
      },
      { onConflict: "workspace_id,email" }
    );

  if (memberError && !/constraint/i.test(memberError.message || "")) {
    throw new Error(memberError.message);
  }

  const { data: existingChannels, error: existingChannelsError } = await supabase
    .from("alert_channels")
    .select("name")
    .eq("workspace_id", workspace.id);
  if (existingChannelsError) {
    throw new Error(existingChannelsError.message);
  }

  const existingChannelNames = new Set((existingChannels ?? []).map((channel) => channel.name));
  const missingChannels = ALERT_SEEDS.filter((channel) => !existingChannelNames.has(channel.name)).map((channel) => ({
    workspace_id: workspace.id,
    ...channel
  }));

  if (missingChannels.length > 0) {
    const { error: channelInsertError } = await supabase.from("alert_channels").insert(missingChannels);
    if (channelInsertError) {
      throw new Error(channelInsertError.message);
    }
  }

  const { error: featureFlagError } = await supabase.from("feature_flags").upsert(FEATURE_FLAG_SEEDS, {
    onConflict: "key"
  });
  if (featureFlagError) {
    throw new Error(featureFlagError.message);
  }

  const { error: websiteWorkspaceError } = await supabase
    .from("websites")
    .update({ workspace_id: workspace.id })
    .is("workspace_id", null);
  if (websiteWorkspaceError) {
    throw new Error(websiteWorkspaceError.message);
  }

  return workspace;
}

export async function getDefaultWorkspace() {
  await ensurePlatformSeedData();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getWorkspaceContext() {
  const workspace = await getDefaultWorkspace();

  const [
    { data: plan, error: planError },
    { data: members, error: membersError },
    { data: alertChannels, error: alertChannelsError },
    { data: featureFlags, error: featureFlagsError }
  ] = await Promise.all([
    supabase.from("subscription_plans").select("*").eq("key", workspace.plan_key).maybeSingle(),
    supabase.from("workspace_members").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: true }),
    supabase.from("alert_channels").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: true }),
    supabase.from("feature_flags").select("*").order("key", { ascending: true })
  ]);

  if (planError) throw new Error(planError.message);
  if (membersError) throw new Error(membersError.message);
  if (alertChannelsError) throw new Error(alertChannelsError.message);
  if (featureFlagsError) throw new Error(featureFlagsError.message);

  return {
    workspace,
    plan,
    members: members ?? [],
    alertChannels: alertChannels ?? [],
    featureFlags: featureFlags ?? []
  };
}
