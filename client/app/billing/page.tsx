"use client";

import { useEffect, useState } from "react";
import { fetchBilling, type BillingResponse } from "@/lib/api";
import {
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  SectionHeader
} from "@/components/platform-ui";

export default function BillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setData(await fetchBilling());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load billing.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4">
      <PageIntro
        eyebrow="Billing & Subscriptions"
        title="Present plans, usage, and subscription entitlements clearly."
        description="This section covers the SaaS billing requirements with live usage against seeded plan tiers, and it leaves clear product space for Stripe, trials, coupons, and upgrades."
      />

      <div className="mt-6 space-y-6">
        {loading ? <LoadingPanel label="Loading billing data..." /> : null}
        {error ? <ErrorPanel message={error} /> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Current Plan" value={data.currentPlan?.name ?? "None"} accent />
              <MetricCard label="Websites Used" value={`${data.usage.websites} / ${data.entitlements.maxWebsites}`} />
              <MetricCard label="Pages Used" value={`${data.usage.pages} / ${data.entitlements.maxPages}`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
              <Panel strong>
                <SectionHeader eyebrow="Entitlements" title="Current subscription" subtitle="Live workspace usage and plan capabilities." />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Team Members" value={`${data.usage.teamMembers} / ${data.entitlements.teamMembers}`} />
                  <MetricCard label="Priority Processing" value={data.entitlements.priorityProcessing ? "Included" : "No"} />
                </div>
                <div className="mt-6 grid gap-3">
                  {data.subscriptionFeatures.map((feature) => (
                    <div key={feature} className="metric-card p-4 text-sm text-[var(--foreground)]">
                      {feature}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <SectionHeader eyebrow="Plans" title="Available pricing tiers" subtitle="Starter, Pro, and Agency plan surfaces taken directly from the requirements." />
                <div className="mt-6 grid gap-4">
                  {data.plans.map((plan) => (
                    <div key={plan.key} className="metric-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-[var(--foreground)]">{plan.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            ${plan.monthlyPrice?.toFixed(2)} / month · ${plan.yearlyPrice?.toFixed(2)} / year
                          </p>
                        </div>
                        <span className="tag">{plan.scan_frequency}</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <MetricCard label="Websites" value={plan.max_websites} />
                        <MetricCard label="Pages" value={plan.max_pages} />
                        <MetricCard label="Members" value={plan.team_members} />
                        <MetricCard label="Priority" value={plan.priority_processing ? "Yes" : "No"} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
