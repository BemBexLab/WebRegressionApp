create extension if not exists pgcrypto;

create table if not exists public.subscription_plans (
  key text primary key,
  name text not null,
  max_websites integer not null,
  max_pages integer not null,
  scan_frequency text not null,
  team_members integer not null default 1,
  priority_processing boolean not null default false,
  monthly_price_cents integer not null default 0,
  yearly_price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_name text not null default 'Platform Owner',
  owner_email text,
  plan_key text references public.subscription_plans(key) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'Owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.alert_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  name text not null,
  target text not null,
  enabled boolean not null default true,
  triggers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  label text not null,
  enabled boolean not null default false,
  scope text not null default 'global',
  created_at timestamptz not null default now()
);

alter table public.websites add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.websites add column if not exists display_name text;
alter table public.websites add column if not exists github_url text;
alter table public.websites add column if not exists monitoring_frequency text not null default 'daily';
alter table public.websites add column if not exists load_time_threshold_ms integer not null default 4000;
alter table public.websites add column if not exists critical_elements jsonb not null default '[]'::jsonb;
alter table public.websites add column if not exists monitored_pages jsonb not null default '[]'::jsonb;
alter table public.websites add column if not exists alert_channels jsonb not null default '[]'::jsonb;
alter table public.websites add column if not exists active boolean not null default true;
alter table public.websites add column if not exists last_scan_at timestamptz;

insert into public.subscription_plans (key, name, max_websites, max_pages, scan_frequency, team_members, priority_processing, monthly_price_cents, yearly_price_cents)
values
  ('starter', 'Starter', 5, 25, 'daily', 1, false, 2900, 29000),
  ('pro', 'Pro', 25, 250, 'hourly', 5, false, 9900, 99000),
  ('agency', 'Agency', 100, 1000, 'hourly', 20, true, 24900, 249000)
on conflict (key) do nothing;

insert into public.workspaces (name, slug, owner_name, owner_email, plan_key)
values ('Default Workspace', 'default-workspace', 'Platform Owner', 'owner@example.com', 'pro')
on conflict (slug) do nothing;

insert into public.workspace_members (workspace_id, full_name, email, role)
select w.id, 'Platform Owner', 'owner@example.com', 'Owner'
from public.workspaces w
where w.slug = 'default-workspace'
  and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = w.id and m.email = 'owner@example.com'
  );

update public.websites
set workspace_id = (
  select id from public.workspaces where slug = 'default-workspace' limit 1
)
where workspace_id is null;

insert into public.alert_channels (workspace_id, type, name, target, enabled, triggers)
select w.id, v.type, v.name, v.target, true, v.triggers::jsonb
from public.workspaces w
cross join (
  values
    ('email', 'Ops Email', 'alerts@example.com', '["visual","uptime","console","load-time"]'),
    ('slack', 'Engineering Slack', '#regression-alerts', '["visual","uptime","dom"]'),
    ('webhook', 'Automation Webhook', 'https://example.com/webhooks/regression', '["visual","functional","performance"]')
) as v(type, name, target, triggers)
where w.slug = 'default-workspace'
  and not exists (
    select 1 from public.alert_channels a
    where a.workspace_id = w.id and a.name = v.name
  );

insert into public.feature_flags (key, label, enabled, scope)
values
  ('public_share_links', 'Public Share Links', false, 'workspace'),
  ('whatsapp_alerts', 'WhatsApp Alerts', false, 'workspace'),
  ('sms_alerts', 'SMS Alerts', false, 'workspace'),
  ('white_label', 'White Label Mode', false, 'workspace')
on conflict (key) do nothing;

alter table public.subscription_plans enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.alert_channels enable row level security;
alter table public.feature_flags enable row level security;

drop policy if exists "Allow read subscription_plans" on public.subscription_plans;
create policy "Allow read subscription_plans"
on public.subscription_plans
for select
using (true);

drop policy if exists "Allow read workspaces" on public.workspaces;
create policy "Allow read workspaces"
on public.workspaces
for select
using (true);

drop policy if exists "Allow read workspace_members" on public.workspace_members;
create policy "Allow read workspace_members"
on public.workspace_members
for select
using (true);

drop policy if exists "Allow read alert_channels" on public.alert_channels;
create policy "Allow read alert_channels"
on public.alert_channels
for select
using (true);

drop policy if exists "Allow read feature_flags" on public.feature_flags;
create policy "Allow read feature_flags"
on public.feature_flags
for select
using (true);

alter publication supabase_realtime add table public.subscription_plans;
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.workspace_members;
alter publication supabase_realtime add table public.alert_channels;
alter publication supabase_realtime add table public.feature_flags;
