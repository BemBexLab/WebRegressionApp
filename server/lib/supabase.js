import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_INTERNAL_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env or Docker Compose environment."
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
