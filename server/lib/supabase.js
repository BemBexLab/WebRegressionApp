import { createClient } from "@supabase/supabase-js";

function isLikelyDockerRuntime() {
  return Boolean(process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST || process.env.CONTAINER);
}

function resolveSupabaseUrl() {
  const internalUrl = process.env.SUPABASE_INTERNAL_URL;
  const publicUrl =
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  // When an explicit internal URL is provided, prefer it. In this repo's
  // Docker setup that points to host.docker.internal, while host-only dev
  // simply omits the variable and falls back to the public localhost URL.
  if (internalUrl) {
    return internalUrl;
  }

  if (publicUrl) {
    return publicUrl;
  }

  return internalUrl || publicUrl;
}

const supabaseUrl = resolveSupabaseUrl();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in server/.env or Docker Compose environment."
  );
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export function buildSupabaseStoragePublicPath(bucketName, objectKey) {
  const normalizedBucket = String(bucketName || "").replace(/^\/+|\/+$/g, "");
  const normalizedObjectKey = String(objectKey || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/storage/v1/object/public/${normalizedBucket}/${normalizedObjectKey}`;
}
